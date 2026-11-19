# `@zenith/sso-ui` Upgrade (`PIPL-CSUI/sso-ui.js` & `rkkautsar/sso-ui` Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `@zenith/sso-ui` (`packages/sso-ui`) with the full 327-entry Universitas Indonesia `kd_org` catalog, bilingual Indonesian/English `OrgDetail` metadata, string-safe CAS 1.0/2.0/3.0 XML/JSON/text parsing (`parseTagValue: false`), and a configurable `SSO` class (`validate` + `validateSafe`) following `PIPL-CSUI/sso-ui.js` and `rkkautsar/sso-ui` best practices.

**Architecture:** `@zenith/sso-ui` remains a pure, zero-Express TypeScript ESM package in `packages/sso-ui` with zero HTML/credential scraping. It uses native `URL` / `URLSearchParams`, `fetch` with `AbortController` cleanup, and `fast-xml-parser` (`parseTagValue: false`, `removeNSPrefix: true`, `trimValues: true`) so 18-digit staff `nip` numbers and leading-zero `kd_org`/`npm` strings never lose precision. Both functional exports (`getLoginUrl`, `getLogoutUrl`, `validateTicket`, `mapOrgCode`, `lookupOrgCode`, `getOrgMap`, `parseResponse`) and the `SSO` class (`new SSO(config)`) are exported for drop-in compatibility.

**Tech Stack:** pnpm Workspaces, Turborepo, TypeScript 5.8, Vitest, Fastify v5, `fast-xml-parser`.

**Spec:** [`docs/PRD.md`](file:///d:/CSUI-ZenithService/docs/PRD.md)

## Global Constraints

- **Maximum 2 files modified per task:** Every task in this plan modifies at most 2 files and ends with a deterministic verification command.
- **Native capabilities first (`ponytail`):** Add zero new third-party dependencies. Use native `URL`, `URLSearchParams`, `fetch`, `AbortController`, and the already-installed `fast-xml-parser` in `@zenith/sso-ui`.
- **Strict CAS Protocol Only:** Never scrape HTML login forms or accept raw username/password credentials; only construct official CAS URLs (`/validate`, `/serviceValidate`, `/p3/serviceValidate`) and validate service tickets back-channel.
- **UI & Design Integrity (`ui-ux-pro-max` / `anti-slop`):** No frontend UI changes are required; preserve all design tokens in `apps/frontend/DESIGN.md` and `apps/frontend/src/index.css`.

## Review Focus

1. **18-Digit Staff `nip` Precision Preservation:** `XMLParser` must set `parseTagValue: false` so 18-digit `nip` values (`198001012005011001` > `Number.MAX_SAFE_INTEGER`) and leading-zero `kd_org` values (`01.00.12.01`) are never coerced into IEEE-754 numbers.
2. **Dual `kd_org` Format Resolution:** `mapOrgCode('01.00.12.01')` (full 4-segment UI code) and `mapOrgCode('12')` (CSUI short code) must both resolve to Fasilkom S1 Ilmu Komputer with both Zenith camelCase (`studyProgram`, `programType`), `PIPL-CSUI/sso-ui.js` bilingual fields (`fakultas`, `faculty`, `facultyEn`, `fak`, `fac`, `prodi`, `major`, `educationalProgram`), and `rkkautsar/sso-ui` snake_case aliases (`study_program`, `educational_program`).
3. **Unknown or Empty `kd_org` Safety:** `mapOrgCode('99.99.99.99')` and `mapOrgCode(undefined)` must return `null` (`lookupOrgCode` returns `undefined`) without throwing.
4. **CAS 1.0, 2.0, and 3.0 (XML & JSON) Parsing:** `parseResponse()` must handle `cas:`-prefixed XML, unprefixed XML, top-level or nested `<cas:attributes>`, CAS 3.0 JSON (`serviceResponse`), and CAS 1.0 `yes\n<username>` responses.
5. **Non-Throwing `SSO.validateSafe()`:** `sso.validateSafe(ticket)` must catch network and CAS validation errors and return `{ success: false, error: Error }` without throwing.

---

## File Map

- **Modify:**
  - `packages/sso-ui/src/data/org_code_details.json` — Full 327-entry UI `XX.XX.XX.XX` catalog + CSUI short codes (`12`, `13`, `14`, `15`).
  - `packages/sso-ui/src/orgMapper.ts` — Bilingual `OrgDetail` / `OrgDetails` mapper (`mapOrgCode`, `lookupOrgCode`, `getOrgMap`, `ORG_CODES`).
  - `packages/sso-ui/src/cas.ts` — `LoginURL`/`getLoginUrl`, `LogoutURL`/`getLogoutUrl`, `ValidateURL`, `parseResponse`, `validateTicket`, and `SSO` class.
  - `packages/sso-ui/src/index.ts` — Barrel exports for all functions, constants, types, and `SSO` default/named class.
  - `packages/sso-ui/src/__tests__/sso-ui.test.ts` — Unit test suite covering CAS 1.0/2.0/3.0, 18-digit `nip`, full & short `kd_org`, and `SSO` class methods.
  - `apps/backend/src/routes/auth.ts` — Include `username: user.username` on `sessionUser` from `@zenith/sso-ui`.
  - `apps/backend/src/__tests__/api.test.ts` — Verify `/api/v1/auth/callback` populates `user.username` and resolved `user.org` for `01.00.12.01`.

---

### Task 1: Populate Full UI `org_code_details.json` & Bilingual `orgMapper.ts`

**Files:**
- Modify: `packages/sso-ui/src/data/org_code_details.json`
- Modify: `packages/sso-ui/src/orgMapper.ts`

- [ ] **Step 1: Populate `packages/sso-ui/src/data/org_code_details.json` with the full UI `XX.XX.XX.XX` catalog from `PIPL-CSUI/sso-ui.js` plus CSUI short codes (`12`–`15`)**

Run:
```powershell
node -e 'async function main() { const fs = require(\"node:fs\"); const txt = await (await fetch(\"https://raw.githubusercontent.com/PIPL-CSUI/sso-ui.js/master/src/kd_org/codes.ts\")).text(); const jsonStr = txt.slice(txt.indexOf(\"{\", txt.indexOf(\"ORG_CODES\"))).replace(/;\s*$/, \"\"); const rawCodes = JSON.parse(jsonStr); const merged = { ...rawCodes, \"12\": { faculty: \"Ilmu Komputer\", shortFaculty: \"Fasilkom\", major: \"Ilmu Komputer (Computer Science)\", program: \"S1 (Undergraduate Program)\" }, \"13\": { faculty: \"Ilmu Komputer\", shortFaculty: \"Fasilkom\", major: \"Sistem Informasi (Information System)\", program: \"S1 (Undergraduate Program)\" }, \"14\": { faculty: \"Ilmu Komputer\", shortFaculty: \"Fasilkom\", major: \"Kecerdasan Artifisial (Artificial Intelligence)\", program: \"S1 (Undergraduate Program)\" }, \"15\": { faculty: \"Ilmu Komputer\", shortFaculty: \"Fasilkom\", major: \"Ilmu Komputer KKI (Computer Science - Intl)\", program: \"S1 (Undergraduate Program)\" } }; fs.writeFileSync(\"packages/sso-ui/src/data/org_code_details.json\", JSON.stringify(merged, null, 2) + \"\n\"); console.log(\"Entries written:\", Object.keys(merged).length); } main();'
```
Expected: `Entries written: 331`

- [ ] **Step 2: Update `packages/sso-ui/src/orgMapper.ts` with bilingual `OrgDetail` / `OrgDetails` resolution**

Replace `packages/sso-ui/src/orgMapper.ts` with:
```ts
import orgData from './data/org_code_details.json' with { type: 'json' };

export interface RawOrgEntry {
  faculty: string;
  shortFaculty?: string;
  major?: string;
  program?: string;
  studyProgram?: string;
  programType?: string;
  study_program?: string;
  educational_program?: string;
}

export interface OrgDetail {
  /** Indonesian faculty name (e.g. "Fakultas Ilmu Komputer") */
  fakultas: string;
  /** Faculty name (Indonesian full name, e.g. "Fakultas Ilmu Komputer") */
  faculty: string;
  /** English faculty name (e.g. "Faculty of Computer Science") */
  facultyEn: string;
  /** Short Indonesian faculty name (e.g. "Fasilkom") */
  fak: string;
  /** Short English faculty code (e.g. "CS") */
  fac: string;
  /** Indonesian department name */
  departemen: string;
  /** English department name */
  department: string;
  /** Short department code */
  dep: string;
  /** Indonesian study program name (e.g. "Ilmu Komputer") */
  prodi: string;
  /** English major name (e.g. "Computer Science") */
  major: string;
  /** Zenith studyProgram (clean Indonesian study program name, e.g. "Ilmu Komputer") */
  studyProgram: string;
  /** Zenith normalized degree level (e.g. "S1", "S2", "S3", "D3", "Profesi", "Spesialis") */
  programType: string;
  /** Full program label from UI catalog (e.g. "S1 Reguler (Undergraduate Program)") */
  educationalProgram: string;
  /** rkkautsar/sso-ui snake_case aliases */
  study_program: string;
  educational_program: string;
}

export type OrgDetails = OrgDetail;

export const ORG_CODES: Readonly<Record<string, RawOrgEntry>> = orgData as Record<string, RawOrgEntry>;

const FACULTY_EN_MAP: Record<string, { en: string; fac: string }> = {
  'Kedokteran': { en: 'Faculty of Medicine', fac: 'FK' },
  'Kedokteran Gigi': { en: 'Faculty of Dentistry', fac: 'FKG' },
  'Matematika & Ilmu Pengetahuan Alam': { en: 'Faculty of Mathematics and Natural Sciences', fac: 'SCI' },
  'Teknik': { en: 'Faculty of Engineering', fac: 'ENG' },
  'Hukum': { en: 'Faculty of Law', fac: 'LAW' },
  'Ekonomi': { en: 'Faculty of Economics and Business', fac: 'FEB' },
  'Ekonomi & Bisnis': { en: 'Faculty of Economics and Business', fac: 'FEB' },
  'Ilmu Pengetahuan Budaya': { en: 'Faculty of Humanities', fac: 'HUM' },
  'Psikologi': { en: 'Faculty of Psychology', fac: 'FPSI' },
  'Ilmu Sosial & Ilmu Politik': { en: 'Faculty of Social and Political Sciences', fac: 'FISIP' },
  'Kesehatan Masyarakat': { en: 'Faculty of Public Health', fac: 'FKM' },
  'Ilmu Komputer': { en: 'Faculty of Computer Science', fac: 'CS' },
  'Ilmu Keperawatan': { en: 'Faculty of Nursing', fac: 'FIK' },
  'Farmasi': { en: 'Faculty of Pharmacy', fac: 'PHARM' },
  'Ilmu Administrasi': { en: 'Faculty of Administrative Sciences', fac: 'FIA' },
  'Program Pendidikan Vokasi': { en: 'Vocational Education Program', fac: 'VOKASI' },
  'Sekolah Ilmu Lingkungan': { en: 'School of Environmental Science', fac: 'SIL' },
  'Sekolah Kajian Stratejik & Global': { en: 'School of Strategic and Global Studies', fac: 'SKSG' },
};

function normalizeFacultyId(rawFaculty: string): { base: string; full: string } {
  const trimmed = rawFaculty.trim().replace(/^Fakultas\s+/i, '');
  const full =
    rawFaculty.startsWith('Fakultas') ||
    rawFaculty.startsWith('Sekolah') ||
    rawFaculty.startsWith('Program')
      ? rawFaculty.trim()
      : `Fakultas ${trimmed}`;
  return { base: trimmed, full };
}

function extractProgramType(rawProgram: string): string {
  const match = rawProgram.trim().match(/^(S1|S2|S3|D3|D4|Profesi|Spesialis)/i);
  return match ? match[1] : rawProgram.trim();
}

function buildOrgDetail(raw: RawOrgEntry): OrgDetail {
  const { base, full } = normalizeFacultyId(raw.faculty);
  const fak = raw.shortFaculty || '';
  const meta = FACULTY_EN_MAP[base] || { en: `Faculty of ${base}`, fac: fak };

  const rawMajor = raw.major || raw.studyProgram || raw.study_program || '';
  const majorMatch = rawMajor.match(/^(.*?)(?:\s*\((.*?)\))?$/);
  const prodi = (majorMatch?.[1] || rawMajor).trim();
  const majorEn = (majorMatch?.[2] || prodi).trim();

  const educationalProgram =
    raw.program || raw.educational_program || raw.programType || '';
  const programType = raw.programType || extractProgramType(educationalProgram);
  const studyProgram = raw.studyProgram || prodi;

  return {
    fakultas: full,
    faculty: full,
    facultyEn: meta.en,
    fak,
    fac: meta.fac,
    departemen: base,
    department: meta.en,
    dep: fak,
    prodi,
    major: majorEn,
    studyProgram,
    programType,
    educationalProgram,
    study_program: rawMajor || studyProgram,
    educational_program: educationalProgram,
  };
}

const resolvedOrgMap: Record<string, OrgDetail> = Object.fromEntries(
  Object.entries(ORG_CODES).map(([code, raw]) => [code, buildOrgDetail(raw)]),
);

/** Resolve a UI organization code to faculty and study program metadata (returns null if unknown). */
export function mapOrgCode(kd_org?: string): OrgDetail | null {
  if (!kd_org) return null;
  return resolvedOrgMap[String(kd_org).trim()] ?? null;
}

/** Resolve a UI organization code (PIPL-CSUI/sso-ui.js compatible alias returning undefined if unknown). */
export function lookupOrgCode(code?: string): OrgDetail | undefined {
  return mapOrgCode(code) ?? undefined;
}

/** Return the read-only resolved organization code dictionary bundled with this package. */
export function getOrgMap(): Readonly<Record<string, OrgDetail>> {
  return resolvedOrgMap;
}
```

- [ ] **Step 3: Verify `@zenith/sso-ui` compiles and typechecks cleanly**

Run:
```powershell
pnpm --filter @zenith/sso-ui run build; pnpm --filter @zenith/sso-ui run lint
```
Expected: Exits with code `0` and zero TypeScript errors.

---

### Task 2: Upgrade CAS 1.0/2.0/3.0 Client, String-Safe XML/JSON Parser & `SSO` Class (`cas.ts` & `index.ts`)

**Files:**
- Modify: `packages/sso-ui/src/cas.ts`
- Modify: `packages/sso-ui/src/index.ts`

- [ ] **Step 1: Upgrade `packages/sso-ui/src/cas.ts` with `PIPL-CSUI/sso-ui.js` URL builders, `parseResponse`, `validateTicket`, and `SSO` class**

Replace `packages/sso-ui/src/cas.ts` with:
```ts
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
        : `INVALID_TICKET: Invalid CAS 1.0 response`,
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
  const url = `${CAS_VALIDATE_URL}?ticket=${encodeURIComponent(ticket.trim())}&service=${encodeURIComponent(serviceUrl)}`;
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
```

- [ ] **Step 2: Update `packages/sso-ui/src/index.ts` to re-export all functions, types, and `SSO`**

Replace `packages/sso-ui/src/index.ts` with:
```ts
export {
  DEFAULT_CAS_URL,
  CAS_BASE,
  CAS_LOGIN_URL,
  CAS_VALIDATE_URL,
  CAS_LOGOUT_URL,
  normalize,
  LoginURL,
  LogoutURL,
  ValidateURL,
  getLoginUrl,
  getLogoutUrl,
  parseResponse,
  validateTicket,
  SSO,
  type CASVersion,
  type LoginUrlOptions,
  type LogoutUrlOptions,
  type ValidateTicketOptions,
  type SSOConfig,
  type SSOOptions,
  type CasUser,
  type SSOUser,
  type ValidateSafeResult,
} from './cas.js';

export {
  ORG_CODES,
  mapOrgCode,
  lookupOrgCode,
  getOrgMap,
  type RawOrgEntry,
  type OrgDetail,
  type OrgDetails,
} from './orgMapper.js';

export { SSO as default } from './cas.js';
```

- [ ] **Step 3: Verify `@zenith/sso-ui` builds and typechecks cleanly**

Run:
```powershell
pnpm --filter @zenith/sso-ui run build; pnpm --filter @zenith/sso-ui run lint
```
Expected: Exits with code `0` and zero errors.

---

### Task 3: Update & Expand `@zenith/sso-ui` Unit Tests (`sso-ui.test.ts`)

**Files:**
- Modify: `packages/sso-ui/src/__tests__/sso-ui.test.ts`

- [ ] **Step 1: Update `packages/sso-ui/src/__tests__/sso-ui.test.ts` to cover full UI `01.00.12.01` & short `12`–`15` org mapping, 18-digit `nip` string safety, CAS 1.0/2.0/3.0 parsing, and the `SSO` class (`validate` + `validateSafe`)**

Replace `packages/sso-ui/src/__tests__/sso-ui.test.ts` with:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import SSO, {
  CAS_LOGIN_URL,
  CAS_LOGOUT_URL,
  CAS_VALIDATE_URL,
  ValidateURL,
  getLoginUrl,
  getLogoutUrl,
  getOrgMap,
  lookupOrgCode,
  mapOrgCode,
  parseResponse,
  validateTicket,
} from '../index.js';

describe('@zenith/sso-ui', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('URL builders', () => {
    it('builds login URL with renew=true and gateway=true', () => {
      const service = 'https://zenith.csui.dev/auth/callback';
      expect(getLoginUrl(service)).toBe(
        `${CAS_LOGIN_URL}?service=${encodeURIComponent(service)}`,
      );
      expect(getLoginUrl(service, { renew: true })).toBe(
        `${CAS_LOGIN_URL}?service=${encodeURIComponent(service)}&renew=true`,
      );
      expect(getLoginUrl(service, { renew: true, gateway: true })).toBe(
        `${CAS_LOGIN_URL}?service=${encodeURIComponent(service)}&renew=true&gateway=true`,
      );
    });

    it('builds URL-encoded logout URL and versioned ValidateURL', () => {
      const returnUrl = 'https://zenith.csui.dev/login?next=/profile';
      expect(getLogoutUrl(returnUrl)).toBe(
        `${CAS_LOGOUT_URL}?url=${encodeURIComponent(returnUrl)}`,
      );
      expect(ValidateURL('https://sso.ui.ac.id/cas2/', returnUrl, 'ST-1', '1.0')).toContain(
        '/cas2/validate?',
      );
      expect(ValidateURL('https://sso.ui.ac.id/cas2', returnUrl, 'ST-3', '3.0')).toContain(
        '/cas2/p3/serviceValidate?',
      );
    });
  });

  describe('orgMapper', () => {
    it('resolves both full UI XX.XX.XX.XX codes and CSUI short codes (12..15)', () => {
      const fullCs = mapOrgCode('01.00.12.01');
      expect(fullCs).toMatchObject({
        fakultas: 'Fakultas Ilmu Komputer',
        faculty: 'Fakultas Ilmu Komputer',
        facultyEn: 'Faculty of Computer Science',
        fak: 'Fasilkom',
        fac: 'CS',
        prodi: 'Ilmu Komputer',
        major: 'Computer Science',
        studyProgram: 'Ilmu Komputer',
        programType: 'S1',
        study_program: 'Ilmu Komputer (Computer Science)',
        educational_program: 'S1 Reguler (Undergraduate Program)',
      });

      expect(mapOrgCode('12')).toMatchObject({
        faculty: 'Fakultas Ilmu Komputer',
        studyProgram: 'Ilmu Komputer',
        programType: 'S1',
      });
      expect(mapOrgCode('13')).toMatchObject({
        faculty: 'Fakultas Ilmu Komputer',
        studyProgram: 'Sistem Informasi',
        programType: 'S1',
      });
      expect(lookupOrgCode('06.00.12.01')?.studyProgram).toBe('Sistem Informasi');
      expect(mapOrgCode('99.99.99.99')).toBeNull();
      expect(lookupOrgCode('99.99.99.99')).toBeUndefined();
      expect(mapOrgCode(undefined)).toBeNull();
      expect(Object.keys(getOrgMap()).length).toBeGreaterThan(300);
    });
  });

  describe('validateTicket & parseResponse', () => {
    it('parses cas:-prefixed CAS 2.0 success XML and resolves full UI kd_org', async () => {
      const xml = `
        <cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
          <cas:authenticationSuccess>
            <cas:user>budi.santoso</cas:user>
            <cas:attributes>
              <cas:nama>Budi Santoso</cas:nama>
              <cas:npm> 0606888572 </cas:npm>
              <cas:peran_user>mahasiswa</cas:peran_user>
              <cas:kd_org>01.00.12.01</cas:kd_org>
              <cas:email>budi@ui.ac.id</cas:email>
            </cas:attributes>
          </cas:authenticationSuccess>
        </cas:serviceResponse>
      `;

      const fetchMock = vi.fn().mockResolvedValue(new Response(xml, { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      const user = await validateTicket('ST-123', 'https://zenith.csui.dev/auth/callback');

      expect(fetchMock).toHaveBeenCalledWith(
        `${CAS_VALIDATE_URL}?ticket=ST-123&service=${encodeURIComponent('https://zenith.csui.dev/auth/callback')}`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(user).toMatchObject({
        username: 'budi.santoso',
        nama: 'Budi Santoso',
        name: 'Budi Santoso',
        npm: '0606888572',
        nip: undefined,
        role: 'mahasiswa',
        kd_org: '01.00.12.01',
        orgCode: '01.00.12.01',
        org_code: '01.00.12.01',
        email: 'budi@ui.ac.id',
        org: expect.objectContaining({
          faculty: 'Fakultas Ilmu Komputer',
          studyProgram: 'Ilmu Komputer',
          programType: 'S1',
        }),
      });
    });

    it('preserves 18-digit staff nip strings without IEEE-754 precision loss and handles unmapped kd_org', async () => {
      const xml = `
        <serviceResponse>
          <authenticationSuccess>
            <user>dr.staff</user>
            <attributes>
              <name>Dr. Staff</name>
              <nip>198001012005011009</nip>
              <role>dosen</role>
              <kd_org>99.99.99.99</kd_org>
              <mail>staff@ui.ac.id</mail>
              <mail>alt@ui.ac.id</mail>
            </attributes>
          </authenticationSuccess>
        </serviceResponse>
      `;

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml, { status: 200 })));

      const user = await validateTicket('ST-STAFF', 'https://zenith.csui.dev/auth/callback');
      expect(user.nip).toBe('198001012005011009');
      expect(user.org).toBeNull();
      expect(user.organization).toBeUndefined();
      expect(user.email).toBe('staff@ui.ac.id');
    });

    it('parses CAS 1.0 plain-text and CAS 3.0 JSON responses', () => {
      const cas1User = parseResponse('yes\nraditya.dika\n', '1.0');
      expect(cas1User.username).toBe('raditya.dika');
      expect(cas1User.nama).toBe('raditya.dika');

      const cas3Json = JSON.stringify({
        serviceResponse: {
          authenticationSuccess: {
            user: 'siti.aminah',
            attributes: {
              nama: ['Siti Aminah'],
              npm: ['2406123456'],
              kd_org: ['06.00.12.01'],
            },
          },
        },
      });
      const cas3User = parseResponse(cas3Json, '3.0');
      expect(cas3User.username).toBe('siti.aminah');
      expect(cas3User.org?.studyProgram).toBe('Sistem Informasi');
    });

    it('supports SSO class validate and non-throwing validateSafe', async () => {
      const sso = new SSO({
        serviceUrl: 'https://zenith.csui.dev/auth/callback',
        fetch: vi.fn().mockResolvedValue(
          new Response(
            `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
              <cas:authenticationFailure code="INVALID_TICKET">Ticket ST-BAD not recognized</cas:authenticationFailure>
            </cas:serviceResponse>`,
            { status: 200 },
          ),
        ),
      });

      expect(sso.loginUrl(undefined, { renew: true })).toContain('renew=true');
      expect(sso.logoutUrl('https://zenith.csui.dev')).toContain('url=');
      expect(sso.parseOrg('12')?.studyProgram).toBe('Ilmu Komputer');

      const safeRes = await sso.validateSafe('ST-BAD');
      expect(safeRes.success).toBe(false);
      if (!safeRes.success) {
        expect(safeRes.error.message).toContain('INVALID_TICKET: Ticket ST-BAD not recognized');
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })));
      await expect(
        validateTicket('ST-ERR', 'https://zenith.csui.dev/auth/callback'),
      ).rejects.toThrow('CAS validate failed: 502');
    });
  });
});
```

- [ ] **Step 2: Build, lint, and run the `@zenith/sso-ui` unit tests**

Run:
```powershell
pnpm --filter @zenith/sso-ui run build; pnpm --filter @zenith/sso-ui run lint; pnpm --filter @zenith/sso-ui test
```
Expected: All tests in `src/__tests__/sso-ui.test.ts` and `dist/__tests__/sso-ui.test.js` pass (`0` failures).

---

### Task 4: Expose `username` & Full `01.00.12.01` `org` Metadata in Backend Auth Callback (`auth.ts` & `api.test.ts`)

**Files:**
- Modify: `apps/backend/src/routes/auth.ts`
- Modify: `apps/backend/src/__tests__/api.test.ts`

- [ ] **Step 1: Include `username: user.username` in `sessionUser` inside `apps/backend/src/routes/auth.ts`**

In `apps/backend/src/routes/auth.ts`, update `sessionUser`:
```ts
      const sessionUser = {
        username: user.username,
        nama: user.nama,
        npm: npm,
        nip: user.nip,
        role: role,
        kd_org: user.kd_org,
        email: user.email,
        isAdmin,
        isWhitelisted,
        isSuperAdmin,
        org: user.org,
      };
```

- [ ] **Step 2: Assert `username` and resolved `01.00.12.01` `org` in `apps/backend/src/__tests__/api.test.ts`**

In `apps/backend/src/__tests__/api.test.ts`, inside `it('deduplicates repeated GET /api/v1/auth/callback requests for the same single-use CAS ticket', ...)`, assert:
```ts
      expect(firstRes.json().data.user).toMatchObject({
        username: 'vicky.ibrahimovic',
        npm: '2606888572',
        org: expect.objectContaining({
          faculty: 'Fakultas Ilmu Komputer',
          studyProgram: 'Ilmu Komputer',
          programType: 'S1',
        }),
      });
```

- [ ] **Step 3: Run full workspace build, lint, and integration tests**

Run:
```powershell
$env:JWT_SECRET = 'dev-ci-verification-secret'; pnpm turbo run build lint test --force
```
Expected: `11 successful, 11 total` (`@zenith/shared`, `@zenith/sso-ui`, `@zenith/backend`, `@zenith/frontend` all pass with exit code `0`).
