// Pure CAS 1.0 / 2.0 / 3.0 client for SSO-UI (no credential scraping, no Express session coupling)
import { XMLParser } from 'fast-xml-parser';
import { mapOrgCode, type OrgDetail } from './orgMapper.js';

export type CASVersion = '1.0' | '2.0' | '3.0';

export const DEFAULT_CAS_URL = 'https://sso.ui.ac.id/cas2';
export const CAS_BASE = DEFAULT_CAS_URL;
export const CAS_LOGIN_URL = `${CAS_BASE}/login`;
export const CAS_VALIDATE_URL = `${CAS_BASE}/serviceValidate`;
export const CAS_LOGOUT_URL = `${CAS_BASE}/logout`;

export interface LoginUrlOptions {
  serviceUrl?: string;
  renew?: boolean;
  gateway?: boolean;
}

export interface LogoutUrlOptions {
  serviceUrl?: string;
  url?: string;
}

export interface ValidateTicketOptions {
  serviceUrl?: string;
  version?: CASVersion;
  signal?: AbortSignal;
  fetchOptions?: RequestInit;
}

export interface SSOConfig {
  casUrl?: string;
  version?: CASVersion;
  serviceUrl?: string;
  /** Alias for serviceUrl (rkkautsar/sso-ui compatibility) */
  url?: string;
  session_sso?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export type SSOOptions = SSOConfig;

export interface CasUser {
  username: string;
  nama: string;
  name: string;
  npm?: string;
  nip?: string;
  role?: string;
  kd_org?: string;
  orgCode?: string;
  org_code?: string;
  email?: string;
  ldapCn?: string;
  org: OrgDetail | null;
  organization?: OrgDetail;
  rawAttributes: Record<string, string>;
}

export type SSOUser = CasUser;

export type ValidateSafeResult =
  | { success: true; user: CasUser; error?: never }
  | { success: false; user?: never; error: Error };

const xmlParser = new XMLParser({
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export function normalize(url?: string): string {
  return (url || DEFAULT_CAS_URL).trim().replace(/\/+$/, '');
}

export function LoginURL(casUrl: string, serviceUrl?: string, options?: LoginUrlOptions): string {
  const url = new URL(`${normalize(casUrl)}/login`);
  const serv = options?.serviceUrl || serviceUrl;
  if (serv) url.searchParams.set('service', serv);
  if (options?.renew) url.searchParams.set('renew', 'true');
  if (options?.gateway) url.searchParams.set('gateway', 'true');
  return url.toString();
}

export function LogoutURL(casUrl: string, options?: LogoutUrlOptions | string): string {
  const url = new URL(`${normalize(casUrl)}/logout`);
  const opts = typeof options === 'string' ? { url: options } : options;
  const redir = opts?.url || opts?.serviceUrl;
  if (redir) {
    url.searchParams.set('url', redir);
  }
  return url.toString();
}

export function ValidateURL(
  casUrl: string,
  serviceUrl: string,
  ticket: string,
  version: CASVersion = '2.0',
): string {
  let path = '/serviceValidate';
  if (version === '1.0') path = '/validate';
  else if (version === '3.0') path = '/p3/serviceValidate';

  const url = new URL(`${normalize(casUrl)}${path}`);
  url.searchParams.set('ticket', ticket.trim());
  url.searchParams.set('service', serviceUrl);
  return url.toString();
}

/** Build the SSO UI CAS 2.0 login redirect URL. */
export function getLoginUrl(serviceUrl: string, options?: LoginUrlOptions): string {
  const base = `${CAS_LOGIN_URL}?service=${encodeURIComponent(serviceUrl)}`;
  const withRenew = options?.renew ? `${base}&renew=true` : base;
  return options?.gateway ? `${withRenew}&gateway=true` : withRenew;
}

/** Build the SSO UI CAS 2.0 logout redirect URL. */
export function getLogoutUrl(returnUrl: string): string {
  return `${CAS_LOGOUT_URL}?url=${encodeURIComponent(returnUrl)}`;
}

function readAttr(attrs: Record<string, string>, key: string): string | undefined {
  const value = attrs[key];
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildUser(username: string, attrs: Record<string, string>): CasUser {
  const nama =
    readAttr(attrs, 'nama') ??
    readAttr(attrs, 'name') ??
    readAttr(attrs, 'ldap_cn') ??
    username;
  const npm = readAttr(attrs, 'npm');
  const nip = readAttr(attrs, 'nip');
  const role = readAttr(attrs, 'peran_user') ?? readAttr(attrs, 'role');
  const kd_org = readAttr(attrs, 'kd_org') ?? readAttr(attrs, 'org_code');
  const email = readAttr(attrs, 'email') ?? readAttr(attrs, 'mail');
  const ldapCn = readAttr(attrs, 'ldap_cn');
  const org = mapOrgCode(kd_org);

  return {
    username,
    nama,
    name: nama,
    npm,
    nip,
    role,
    kd_org,
    orgCode: kd_org,
    org_code: kd_org,
    email,
    ldapCn,
    org,
    organization: org ?? undefined,
    rawAttributes: attrs,
  };
}

/** Parse a CAS 1.0, 2.0, or 3.0 response body (XML, JSON, or plain text) into a normalized CasUser. */
export function parseResponse(body: string, version: CASVersion = '2.0'): CasUser {
  if (version === '1.0') {
    const lines = body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines[0]?.toLowerCase() === 'yes' && lines[1]) {
      return buildUser(lines[1], { username: lines[1] });
    }
    throw new Error(
      lines[0]?.toLowerCase() === 'no'
        ? 'INVALID_TICKET: CAS 1.0 ticket validation failed'
        : 'INVALID_TICKET: Invalid CAS 1.0 response',
    );
  }

  const trimmed = body.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const data = JSON.parse(trimmed);
    const sResp = data.serviceResponse || data;
    if (sResp.authenticationFailure) {
      const fail = sResp.authenticationFailure;
      const code = fail.code || 'INVALID_TICKET';
      const desc = fail.description || fail.message || 'Ticket validation failed';
      throw new Error(`${code}: ${desc}`);
    }
    const success = sResp.authenticationSuccess;
    if (!success) {
      throw new Error('INVALID_TICKET: Missing authenticationSuccess in CAS JSON response');
    }
    const attrs: Record<string, string> = {};
    if (success.attributes && typeof success.attributes === 'object') {
      for (const [k, v] of Object.entries(success.attributes)) {
        const first = Array.isArray(v) ? v[0] : v;
        if (first !== undefined && first !== null) {
          attrs[k] = String(first).trim();
        }
      }
    }
    const username = String(success.user ?? attrs.nama ?? attrs.name ?? '').trim();
    return buildUser(username, attrs);
  }

  const parsed = xmlParser.parse(trimmed);
  const resp = parsed?.serviceResponse || parsed;
  const success = resp?.authenticationSuccess;
  if (!success) {
    const failure = resp?.authenticationFailure;
    const code = (typeof failure === 'object' && failure?.['@_code']) || 'INVALID_TICKET';
    const msg =
      typeof failure === 'string'
        ? failure
        : failure?.['#text'] || 'Ticket validation failed';
    throw new Error(`${code}: ${msg}`);
  }

  const rawAttrs = (success.attributes || {}) as Record<string, unknown>;
  const attrs: Record<string, string> = {};

  for (const [k, v] of Object.entries(rawAttrs)) {
    if (!k.startsWith('@_')) {
      const first = Array.isArray(v) ? v[0] : v;
      if (first !== undefined && first !== null) {
        attrs[k] = String(first).trim();
      }
    }
  }

  for (const [k, v] of Object.entries(success as Record<string, unknown>)) {
    if (k !== 'user' && k !== 'attributes' && !k.startsWith('@_') && typeof v !== 'object') {
      if (!attrs[k] && v !== undefined && v !== null) {
        attrs[k] = String(v).trim();
      }
    }
  }

  const username =
    success.user !== undefined && success.user !== null ? String(success.user).trim() : '';
  return buildUser(username, attrs);
}

/** Validate a CAS 2.0 service ticket and resolve UI organization metadata. */
export async function validateTicket(
  ticket: string,
  serviceUrl: string,
  options?: ValidateTicketOptions,
): Promise<CasUser> {
  const version = options?.version ?? '2.0';
  const url =
    version === '2.0'
      ? `${CAS_VALIDATE_URL}?ticket=${encodeURIComponent(ticket.trim())}&service=${encodeURIComponent(serviceUrl)}`
      : ValidateURL(DEFAULT_CAS_URL, serviceUrl, ticket, version);
  const res = await fetch(url, {
    signal: options?.signal ?? AbortSignal.timeout(10_000),
    ...options?.fetchOptions,
  });
  if (!res.ok) throw new Error(`CAS validate failed: ${res.status}`);

  const text = await res.text();
  return parseResponse(text, version);
}

/** Configurable CAS client class compatible with PIPL-CSUI/sso-ui.js & rkkautsar/sso-ui. */
export class SSO {
  public readonly casUrl: string;
  public readonly serviceUrl?: string;
  public readonly version: CASVersion;
  public readonly timeoutMs: number;
  public readonly fetchFn: typeof globalThis.fetch;

  constructor(config: SSOConfig = {}) {
    this.casUrl = normalize(config.casUrl || DEFAULT_CAS_URL);
    this.serviceUrl = config.serviceUrl || config.url;
    this.version = config.version || '2.0';
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.fetchFn = config.fetch || globalThis.fetch;
  }

  loginUrl(serviceUrl?: string, options?: LoginUrlOptions): string {
    return LoginURL(this.casUrl, serviceUrl || this.serviceUrl, options);
  }

  logoutUrl(options?: LogoutUrlOptions | string): string {
    if (typeof options === 'string') {
      return LogoutURL(this.casUrl, { url: options });
    }
    return LogoutURL(this.casUrl, { serviceUrl: this.serviceUrl, ...options });
  }

  parseOrg(kd_org?: string): OrgDetail | null {
    return mapOrgCode(kd_org);
  }

  async validate(ticket: string, options?: ValidateTicketOptions | string): Promise<CasUser> {
    if (!ticket) throw new Error('Ticket is required');
    const serviceUrl =
      typeof options === 'string' ? options : options?.serviceUrl || this.serviceUrl;
    if (!serviceUrl) throw new Error('serviceUrl is required for ticket validation');

    const version = (typeof options === 'object' && options?.version) || this.version;
    const url = ValidateURL(this.casUrl, serviceUrl, ticket, version);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    if (typeof options === 'object' && options?.signal) {
      options.signal.addEventListener(
        'abort',
        () => controller.abort(options.signal?.reason),
        { once: true },
      );
    }

    try {
      const resp = await this.fetchFn(url, {
        method: 'GET',
        signal: controller.signal,
        ...(typeof options === 'object' ? options?.fetchOptions : {}),
      });
      if (!resp.ok) throw new Error(`CAS validate failed: ${resp.status}`);
      const text = await resp.text();
      return parseResponse(text, version);
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateSafe(
    ticket: string,
    options?: ValidateTicketOptions | string,
  ): Promise<ValidateSafeResult> {
    try {
      const user = await this.validate(ticket, options);
      return { success: true, user };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

export default SSO;
