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
