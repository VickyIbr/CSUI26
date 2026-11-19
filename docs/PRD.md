# PRD: Upgrading `@zenith/sso-ui` with `PIPL-CSUI/sso-ui.js` & `rkkautsar/sso-ui` Best Practices

## 1. Overview & Architectural Findings

We evaluated two Universitas Indonesia SSO libraries against our `@zenith/sso-ui` (`packages/sso-ui`) workspace package:
1. **[`rkkautsar/sso-ui`](https://github.com/rkkautsar/sso-ui) (npm `sso-ui`):** Legacy 2016 CommonJS Express 4 middleware coupled to stateful `express-session` and `github:rkkautsar/cas-authentication`. Incompatible with Fastify v5 + Vercel Serverless stateless JWTs, and throws in strict mode or on unknown `kd_org`.
2. **[`PIPL-CSUI/sso-ui.js`](https://github.com/PIPL-CSUI/sso-ui.js):** Modern, zero-Express, type-safe TypeScript CAS client (`1.0`, `2.0`, `3.0`) using standard CAS ticket validation (no credential scraping), `fast-xml-parser` with `parseTagValue: false` (preventing IEEE-754 integer precision loss on 18-digit staff `nip` and leading-zero `kd_org`/`npm`), bilingual `OrgDetails` (`fakultas`/`faculty`, `fak`/`fac`, `prodi`/`major`), injectable `fetch`/`AbortSignal`, and a clean `SSO` class with `validate()` and `validateSafe()`.

### Decision
Upgrade `@zenith/sso-ui` (`packages/sso-ui`) by adopting the pure-CAS architecture and best practices of **`PIPL-CSUI/sso-ui.js`** combined with **`rkkautsar/sso-ui`** organization-code compatibility and our existing Zenith contracts — with **zero** HTML/credential scraping and **zero** Express session dependencies.

---

## 2. Best Practices Adopted from `PIPL-CSUI/sso-ui.js`

1. **String-Safe XML Parsing (`parseTagValue: false`, `removeNSPrefix: true`, `trimValues: true`):**
   - Prevents `fast-xml-parser` from coercing 18-digit staff `nip` values (e.g. `198001012005011001` > `Number.MAX_SAFE_INTEGER`) or leading-zero `npm`/`kd_org` strings into corrupted JS numbers.
2. **Standard CAS 1.0 / 2.0 / 3.0 Protocol Only (No Credential Scraping):**
   - Uses official CAS redirect and ticket validation endpoints (`/validate`, `/serviceValidate`, `/p3/serviceValidate`) via `URL` and `URLSearchParams` (`renew`, `gateway`, `service`, `url`).
   - Supports both CAS XML (`2.0`/`3.0`), CAS JSON (`3.0`), and CAS plain-text (`1.0`) validation payloads via `parseResponse(body, version)`.
   - Explicitly checks `res.ok` before parsing and cleans up `AbortController` timeouts in a `finally` block.
3. **Rich Bilingual `OrgDetails` + Full UI `ORG_CODES` Dictionary:**
   - Includes the full UI `XX.XX.XX.XX` catalog (`ORG_CODES`) with Indonesian and English faculty/major names (`fakultas`, `faculty`, `fak`, `fac`, `departemen`, `department`, `dep`, `prodi`, `major`, `studyProgram`, `educationalProgram`) plus Zenith's `programType` (`S1`, `S2`, `S3`, `D3`, `Profesi`, `Spesialis`) and CSUI short-code aliases (`12`, `13`, `14`, `15`).
4. **Ergonomic `SSO` Class + Result-Typed `validateSafe()`:**
   - Provides `new SSO(config)` (`casUrl`, `serviceUrl`, `version`, `timeoutMs`, injectable `fetch`) with `.loginUrl()`, `.logoutUrl()`, `.validate()`, and non-throwing `.validateSafe()` returning `{ success: true, user } | { success: false, error }`, while keeping standalone functions (`getLoginUrl`, `getLogoutUrl`, `validateTicket`, `mapOrgCode`, `getOrgMap`, `lookupOrgCode`) for existing callers.

---

## 3. Data Models & Public API Contract (`@zenith/sso-ui`)

```ts
export type CASVersion = '1.0' | '2.0' | '3.0';

export interface OrgDetail {
  /** Indonesian faculty name (e.g. "Fakultas Ilmu Komputer") */
  fakultas: string;
  /** Faculty name (kept as Indonesian faculty name on short/Zenith compat or English on OrgDetails) */
  faculty: string;
  /** English faculty name (e.g. "Faculty of Computer Science") */
  facultyEn: string;
  /** Short Indonesian faculty code (e.g. "Fasilkom") */
  fak: string;
  /** Short English faculty subdomain code (e.g. "CS") */
  fac: string;
  /** Indonesian study program name (e.g. "Ilmu Komputer") */
  prodi: string;
  /** English major name (e.g. "Computer Science") */
  major: string;
  /** Zenith studyProgram (e.g. "Ilmu Komputer") */
  studyProgram: string;
  /** Zenith normalized degree level (e.g. "S1", "S2", "S3", "D3") */
  programType: string;
  /** Full program description from UI catalog (e.g. "S1 Reguler (Undergraduate Program)") */
  educationalProgram: string;
  /** rkkautsar/sso-ui snake_case aliases */
  study_program: string;
  educational_program: string;
}

export type OrgDetails = OrgDetail;

export interface CasUser {
  /** CAS <cas:user> username */
  username: string;
  /** Full name (Zenith compat) */
  nama: string;
  /** Full name (PIPL-CSUI/sso-ui.js & rkkautsar/sso-ui compat) */
  name: string;
  npm?: string;
  nip?: string;
  role?: 'mahasiswa' | 'staff' | string;
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
```

---

## 4. Auth Boundaries & Edge Cases

| Boundary / Scenario | Behavior |
| --- | --- |
| **Strict CAS Redirect Flow Only** | Authentication strictly redirects the browser to `https://sso.ui.ac.id/cas2/login` and validates the returned `ST-...` service ticket back-channel over HTTPS. Password/HTML scraping is prohibited. |
| **18-Digit Staff `nip` & Leading-Zero Codes** | `XMLParser` runs with `parseTagValue: false` so 18-digit `nip` strings (`198001012005011001`) and `kd_org` strings (`01.00.12.01`) are never coerced to floats/numbers. |
| **Single-Use CAS Ticket Replay (Mobile Handphone)** | `GET /api/v1/auth/callback` deduplicates in-flight `validateTicket` calls (`inFlightTickets`) and caches validated `CasUser` payloads for 60s (`validatedTicketCache`) so duplicate mobile requests do not re-hit `sso.ui.ac.id` and fail with `INVALID_TICKET`. |
| **Full (`01.00.12.01`) & Short (`12`–`15`) `kd_org` Lookup** | Both `01.00.12.01` and `12` resolve cleanly via `mapOrgCode()` / `lookupOrgCode()`. Unknown or missing codes return `null` (`undefined` on `organization`) without throwing. |
| **Non-Whitelisted / Staff (`nip`-only) SSO Users** | Receive a signed `httpOnly` JWT cookie (`isWhitelisted: false, isAdmin: false`) and a `403` JSON payload redirecting to `/access-denied`. Protected mutations remain blocked by `requireWhitelisted()` and `adminOnly()`. |

---

## 5. In-Scope vs. Out-of-Scope

### In-Scope
- **Complete UI `ORG_CODES` Dataset (`packages/sso-ui/src/data/org_code_details.json`):**
  - Port the full UI `XX.XX.XX.XX` catalog from `PIPL-CSUI/sso-ui.js` / `rkkautsar/sso-ui` and support CSUI short codes (`12`–`15`).
- **Upgraded CAS Client & Parser (`packages/sso-ui/src/cas.ts`, `orgMapper.ts`, `index.ts`):**
  - Configure `XMLParser` with `parseTagValue: false`, `removeNSPrefix: true`, and `trimValues: true`.
  - Add `URL` / `URLSearchParams` endpoint builders (`LoginURL`, `LogoutURL`, `ValidateURL`, `getLoginUrl`, `getLogoutUrl`) supporting `renew`, `gateway`, and CAS `1.0`/`2.0`/`3.0`.
  - Add `parseResponse(body, version)` supporting XML, JSON, and CAS 1.0 responses plus top-level and nested `<cas:attributes>`, `username`, `ldapCn`, and `rawAttributes`.
  - Export the `SSO` class (`loginUrl`, `logoutUrl`, `validate`, `validateSafe`) alongside existing `@zenith/sso-ui` functions.
- **Comprehensive Unit Tests (`packages/sso-ui/src/__tests__/sso-ui.test.ts`):**
  - Test 18-digit `nip` preservation, full `01.00.12.01` and short `12`–`15` org mapping, `SSO` class (`validate` and `validateSafe`), CAS 1.0/2.0/3.0 parsing, `gateway`/`renew` URL options, and failure cases.

### Out-of-Scope
- Password/HTML form scraping or direct credential handling of any kind.
- Installing Express/session dependencies (`sso-ui`, `express-session`, `cas-authentication`).
- Changing PostgreSQL database schemas, Drizzle migrations, or `/api/v1/*` route contracts.
