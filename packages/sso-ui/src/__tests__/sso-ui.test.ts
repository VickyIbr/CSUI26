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
