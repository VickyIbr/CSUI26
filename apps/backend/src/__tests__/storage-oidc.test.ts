import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPublicUrl,
  getObject,
  headObject,
  putObject,
  resetOidcCredentialsCacheForTests,
  signS3Request,
} from '../services/storage.js';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

describe('storage service Vercel OIDC + S3', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_PUBLIC_URL;
    delete process.env.S3_BUCKET;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.ZENITH_S3_BUCKET_NAME;
    delete process.env.S3_REGION;
    delete process.env.AWS_REGION;
    delete process.env.ZENITH_AWS_REGION;
    delete process.env.AWS_ROLE_ARN;
    delete process.env.ZENITH_AWS_ROLE_ARN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.S3_FORCE_PATH_STYLE;
    delete process.env.VERCEL;
    resetOidcCredentialsCacheForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    globalThis.fetch = ORIGINAL_FETCH;
    resetOidcCredentialsCacheForTests();
    vi.restoreAllMocks();
  });

  it('includes x-amz-security-token in SigV4 signed headers when sessionToken is provided', () => {
    const headers = signS3Request({
      method: 'PUT',
      url: new URL('https://zenith-test.s3.ap-southeast-1.amazonaws.com/members/123.png'),
      headers: { 'content-type': 'image/png' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      accessKeyId: 'ASIA_TEST_KEY',
      secretAccessKey: 'SECRET_TEST_KEY',
      sessionToken: 'SESSION_TOKEN_VALUE',
      region: 'ap-southeast-1',
      now: new Date('2026-11-14T10:00:00.000Z'),
    });

    expect(headers['x-amz-security-token']).toBe('SESSION_TOKEN_VALUE');
    expect(headers.authorization).toContain('SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token');
  });

  it('exchanges VERCEL_OIDC_TOKEN via STS and caches temporary credentials for S3 PUT/HEAD', async () => {
    process.env.AWS_ROLE_ARN = 'arn:aws:iam::615067921718:role/Vercel/test-role';
    process.env.VERCEL_OIDC_TOKEN = 'oidc-jwt-token';
    process.env.S3_BUCKET_NAME = 'zenith-1985ebbb25e0';
    process.env.AWS_REGION = 'ap-southeast-1';

    const futureExp = new Date(Date.now() + 15 * 60_000).toISOString();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://sts.ap-southeast-1.amazonaws.com/') {
        expect(init?.method).toBe('POST');
        return new Response(
          `<AssumeRoleWithWebIdentityResponse>
            <AssumeRoleWithWebIdentityResult>
              <Credentials>
                <AccessKeyId>ASIA_TEMP_ID</AccessKeyId>
                <SecretAccessKey>TEMP_SECRET</SecretAccessKey>
                <SessionToken>TEMP_SESSION</SessionToken>
                <Expiration>${futureExp}</Expiration>
              </Credentials>
            </AssumeRoleWithWebIdentityResult>
          </AssumeRoleWithWebIdentityResponse>`,
          { status: 200 },
        );
      }
      if (url === 'https://zenith-1985ebbb25e0.s3.ap-southeast-1.amazonaws.com/members/2606888572.webp') {
        const hdrs = init?.headers as Record<string, string>;
        expect(hdrs['x-amz-security-token']).toBe('TEMP_SESSION');
        expect(hdrs.authorization).toContain('Credential=ASIA_TEMP_ID/');
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const putResult = await putObject('members/2606888572.webp', Buffer.from('webpdata'), 'image/webp');
    expect(putResult).toEqual({
      key: 'members/2606888572.webp',
      url: '/api/v1/media/members/2606888572.webp',
    });

    const exists = await headObject('members/2606888572.webp');
    expect(exists).toBe(true);

    // 1 STS call + 1 S3 PUT + 1 S3 HEAD = 3 calls total (STS cached across PUT & HEAD)
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(buildPublicUrl('members/2606888572.webp')).toBe('/api/v1/media/members/2606888572.webp');
  });

  it('throws on Vercel when AWS_ROLE_ARN is set without VERCEL_OIDC_TOKEN', async () => {
    process.env.VERCEL = '1';
    process.env.AWS_ROLE_ARN = 'arn:aws:iam::615067921718:role/Vercel/test-role';
    process.env.S3_BUCKET_NAME = 'zenith-1985ebbb25e0';
    process.env.AWS_REGION = 'ap-southeast-1';

    await expect(putObject('members/test.png', Buffer.from('png'), 'image/png')).rejects.toThrow(
      'VERCEL_OIDC_TOKEN is required when AWS_ROLE_ARN is configured on Vercel',
    );
  });

  it('uses request-scoped oidcToken when VERCEL=1 and VERCEL_OIDC_TOKEN env is unset', async () => {
    process.env.VERCEL = '1';
    process.env.AWS_ROLE_ARN = 'arn:aws:iam::615067921718:role/Vercel/test-role';
    process.env.S3_BUCKET_NAME = 'zenith-1985ebbb25e0';
    process.env.AWS_REGION = 'ap-southeast-1';

    const futureExp = new Date(Date.now() + 15 * 60_000).toISOString();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://sts.ap-southeast-1.amazonaws.com/') {
        return new Response(
          `<AssumeRoleWithWebIdentityResponse>
            <AssumeRoleWithWebIdentityResult>
              <Credentials>
                <AccessKeyId>ASIA_HEADER_ID</AccessKeyId>
                <SecretAccessKey>HEADER_SECRET</SecretAccessKey>
                <SessionToken>HEADER_SESSION</SessionToken>
                <Expiration>${futureExp}</Expiration>
              </Credentials>
            </AssumeRoleWithWebIdentityResult>
          </AssumeRoleWithWebIdentityResponse>`,
          { status: 200 },
        );
      }
      if (url === 'https://zenith-1985ebbb25e0.s3.ap-southeast-1.amazonaws.com/members/header-test.webp') {
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const putResult = await putObject('members/header-test.webp', Buffer.from('webp'), 'image/webp', {
      oidcToken: 'header-oidc-jwt',
    });
    expect(putResult.key).toBe('members/header-test.webp');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('supports ZENITH_AWS_ROLE_ARN, ZENITH_AWS_REGION, and ZENITH_S3_BUCKET_NAME fallbacks', async () => {
    process.env.VERCEL = '1';
    process.env.ZENITH_AWS_ROLE_ARN = 'arn:aws:iam::615067921718:role/Vercel/access-v2-test';
    process.env.ZENITH_S3_BUCKET_NAME = 'zenith-1985ebbb25e0';
    process.env.ZENITH_AWS_REGION = 'ap-southeast-1';

    const futureExp = new Date(Date.now() + 15 * 60_000).toISOString();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://sts.ap-southeast-1.amazonaws.com/') {
        return new Response(
          `<AssumeRoleWithWebIdentityResponse>
            <AssumeRoleWithWebIdentityResult>
              <Credentials>
                <AccessKeyId>ASIA_ZENITH_ID</AccessKeyId>
                <SecretAccessKey>ZENITH_SECRET</SecretAccessKey>
                <SessionToken>ZENITH_SESSION</SessionToken>
                <Expiration>${futureExp}</Expiration>
              </Credentials>
            </AssumeRoleWithWebIdentityResult>
          </AssumeRoleWithWebIdentityResponse>`,
          { status: 200 },
        );
      }
      if (url === 'https://zenith-1985ebbb25e0.s3.ap-southeast-1.amazonaws.com/members/zenith-env.webp') {
        if (init?.method === 'GET') {
          return new Response(Buffer.from('webp-bytes'), {
            status: 200,
            headers: { 'content-type': 'image/webp' },
          });
        }
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const putResult = await putObject('members/zenith-env.webp', Buffer.from('webp'), 'image/webp', {
      oidcToken: 'header-oidc-jwt',
    });
    expect(putResult).toEqual({
      key: 'members/zenith-env.webp',
      url: '/api/v1/media/members/zenith-env.webp',
    });

    const fetched = await getObject('members/zenith-env.webp', { oidcToken: 'header-oidc-jwt' });
    expect(fetched?.contentType).toBe('image/webp');
    expect(fetched?.body.toString()).toBe('webp-bytes');
  });

  it('falls back to in-memory store in local/test environments without S3_ENDPOINT or OIDC', async () => {
    const res = await putObject('members/local-test.png', Buffer.from('png'), 'image/png');
    expect(res.key).toBe('members/local-test.png');
    expect(await headObject('members/local-test.png')).toBe(true);
  });
});
