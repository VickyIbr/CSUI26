import { createHash, createHmac } from 'node:crypto';

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// shortcut: in-memory Map store used when S3_ENDPOINT is unset in local unit tests, set S3_ENDPOINT for MinIO/R2
const memoryStore = new Map<string, Buffer>();

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

interface S3Config {
  mode: 'memory' | 'static' | 'oidc';
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  roleArn: string;
  oidcToken: string;
  forcePathStyle: boolean;
  publicUrl: string;
}

interface TemporaryCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAtMs: number;
  cacheKey: string;
}

let cachedOidcCreds: TemporaryCredentials | null = null;
let inFlightStsPromise: Promise<TemporaryCredentials> | null = null;

export function resetOidcCredentialsCacheForTests() {
  cachedOidcCreds = null;
  inFlightStsPromise = null;
}

function getS3Config(env: NodeJS.ProcessEnv = process.env, oidcTokenOverride?: string): S3Config {
  const customEndpoint = (env.S3_ENDPOINT || '').replace(/\/+$/, '');
  const bucket = env.S3_BUCKET || env.S3_BUCKET_NAME || env.ZENITH_S3_BUCKET_NAME || 'zenith-media';
  const region = env.S3_REGION || env.AWS_REGION || env.ZENITH_AWS_REGION || 'auto';
  const awsRegion = region === 'auto' ? 'us-east-1' : region;
  const accessKeyId = env.S3_ACCESS_KEY_ID || '';
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY || '';
  const roleArn = env.AWS_ROLE_ARN || env.ZENITH_AWS_ROLE_ARN || '';
  const oidcToken = (oidcTokenOverride || env.VERCEL_OIDC_TOKEN || '').trim();

  const useOidc = Boolean(!customEndpoint && roleArn && oidcToken);
  if (!customEndpoint && roleArn && !oidcToken && env.VERCEL === '1') {
    throw new Error('VERCEL_OIDC_TOKEN is required when AWS_ROLE_ARN is configured on Vercel');
  }

  const mode: S3Config['mode'] = customEndpoint ? 'static' : useOidc ? 'oidc' : 'memory';
  const endpoint = customEndpoint || (useOidc ? `https://s3.${awsRegion}.amazonaws.com` : '');
  const forcePathStyle =
    env.S3_FORCE_PATH_STYLE !== undefined
      ? env.S3_FORCE_PATH_STYLE !== 'false'
      : Boolean(customEndpoint);

  const defaultPublicUrl = useOidc
    ? '/api/v1/media'
    : customEndpoint
      ? `${customEndpoint}/${bucket}`
      : `http://localhost:9000/${bucket}`;

  const publicUrl = (env.S3_PUBLIC_URL || defaultPublicUrl).replace(/\/+$/, '');

  return {
    mode,
    endpoint,
    bucket,
    region: useOidc ? awsRegion : region,
    accessKeyId,
    secretAccessKey,
    roleArn,
    oidcToken,
    forcePathStyle,
    publicUrl,
  };
}

function buildObjectUrl(key: string, cfg: S3Config = getS3Config()): URL {
  const cleanKey = key.replace(/^\/+/, '');
  const base = new URL(cfg.endpoint);
  if (cfg.forcePathStyle) {
    const prefix = base.pathname === '/' ? '' : base.pathname.replace(/\/+$/, '');
    base.pathname = `${prefix}/${cfg.bucket}/${cleanKey}`;
    return base;
  }
  base.hostname = `${cfg.bucket}.${base.hostname}`;
  base.pathname = `/${cleanKey}`;
  return base;
}

export function buildPublicUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, '');
  return `${getS3Config().publicUrl}/${cleanKey}`;
}

function extractXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return match?.[1]?.trim() || '';
}

async function resolveOidcCredentials(cfg: S3Config): Promise<TemporaryCredentials> {
  const cacheKey = `${cfg.roleArn}:${cfg.oidcToken}`;
  const now = Date.now();
  if (
    cachedOidcCreds &&
    cachedOidcCreds.cacheKey === cacheKey &&
    cachedOidcCreds.expiresAtMs - 60_000 > now
  ) {
    return cachedOidcCreds;
  }

  if (inFlightStsPromise) {
    return inFlightStsPromise;
  }

  inFlightStsPromise = (async () => {
    const stsUrl = `https://sts.${cfg.region}.amazonaws.com/`;
    const body = new URLSearchParams({
      Action: 'AssumeRoleWithWebIdentity',
      Version: '2011-06-15',
      RoleArn: cfg.roleArn,
      RoleSessionName: 'zenith-vercel',
      WebIdentityToken: cfg.oidcToken,
    }).toString();

    const res = await fetch(stsUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const xml = await res.text();
    if (!res.ok) {
      throw new Error(`AWS STS AssumeRoleWithWebIdentity failed (${res.status}): ${xml}`);
    }

    const accessKeyId = extractXmlTag(xml, 'AccessKeyId');
    const secretAccessKey = extractXmlTag(xml, 'SecretAccessKey');
    const sessionToken = extractXmlTag(xml, 'SessionToken');
    const expiration = extractXmlTag(xml, 'Expiration');
    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      throw new Error('AWS STS response missing temporary credentials');
    }

    const parsedExp = Date.parse(expiration);
    const creds: TemporaryCredentials = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      expiresAtMs: Number.isFinite(parsedExp) ? parsedExp : Date.now() + 15 * 60_000,
      cacheKey,
    };
    cachedOidcCreds = creds;
    return creds;
  })().finally(() => {
    inFlightStsPromise = null;
  });

  return inFlightStsPromise;
}

async function resolveSigningCredentials(cfg: S3Config): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}> {
  if (cfg.mode === 'oidc') {
    const creds = await resolveOidcCredentials(cfg);
    return {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };
  }
  return {
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  };
}

export function signS3Request(opts: {
  method: 'GET' | 'PUT' | 'HEAD';
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  now?: Date;
}): Record<string, string> {
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers)) {
    normalized[k.toLowerCase()] = v.trim();
  }
  normalized.host = opts.url.host;
  normalized['x-amz-date'] = amzDate;
  normalized['x-amz-content-sha256'] = opts.payloadHash;
  if (opts.sessionToken) {
    normalized['x-amz-security-token'] = opts.sessionToken;
  }

  const sortedKeys = Object.keys(normalized).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${normalized[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');

  const canonicalUri =
    opts.url.pathname
      .split('/')
      .map((seg) => encodeRfc3986(decodeURIComponent(seg)))
      .join('/') || '/';

  const canonicalQuery = Array.from(opts.url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalRequest = [
    opts.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${opts.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${opts.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, opts.region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const { host: _host, ...outgoing } = normalized;
  outgoing.authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return outgoing;
}

export interface StorageObjectOptions {
  oidcToken?: string;
}

export async function headObject(key: string, options?: StorageObjectOptions): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '');
  const cfg = getS3Config(process.env, options?.oidcToken);
  if (cfg.mode === 'memory') return memoryStore.has(cleanKey);

  const creds = await resolveSigningCredentials(cfg);
  const url = buildObjectUrl(cleanKey, cfg);
  const headers = signS3Request({
    method: 'HEAD',
    url,
    headers: {},
    payloadHash: EMPTY_SHA256,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    region: cfg.region,
  });

  const res = await fetch(url, { method: 'HEAD', headers });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`S3 HEAD failed (${res.status})`);
  return true;
}

function inferContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export async function getObject(
  key: string,
  options?: StorageObjectOptions,
): Promise<{ body: Buffer; contentType: string; cacheControl?: string } | null> {
  const cleanKey = key.replace(/^\/+/, '');
  const cfg = getS3Config(process.env, options?.oidcToken);
  if (cfg.mode === 'memory') {
    const body = memoryStore.get(cleanKey);
    if (!body) return null;
    return {
      body,
      contentType: inferContentType(cleanKey),
      cacheControl: 'public, max-age=31536000, immutable',
    };
  }

  const creds = await resolveSigningCredentials(cfg);
  const url = buildObjectUrl(cleanKey, cfg);
  const headers = signS3Request({
    method: 'GET',
    url,
    headers: {},
    payloadHash: EMPTY_SHA256,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    region: cfg.region,
  });

  const res = await fetch(url, { method: 'GET', headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 GET failed (${res.status})`);

  const body = Buffer.from(await res.arrayBuffer());
  return {
    body,
    contentType: res.headers.get('content-type') || inferContentType(cleanKey),
    cacheControl: res.headers.get('cache-control') || 'public, max-age=31536000, immutable',
  };
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  options?: StorageObjectOptions,
): Promise<{ key: string; url: string }> {
  const cleanKey = key.replace(/^\/+/, '');
  const cfg = getS3Config(process.env, options?.oidcToken);
  if (cfg.mode === 'memory') {
    memoryStore.set(cleanKey, body);
    return { key: cleanKey, url: buildPublicUrl(cleanKey) };
  }

  const creds = await resolveSigningCredentials(cfg);
  const url = buildObjectUrl(cleanKey, cfg);
  const headers = signS3Request({
    method: 'PUT',
    url,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
    payloadHash: sha256Hex(body),
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    region: cfg.region,
  });

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`S3 PUT failed (${res.status}): ${errText}`);
  }
  return { key: cleanKey, url: `${cfg.publicUrl}/${cleanKey}` };
}
