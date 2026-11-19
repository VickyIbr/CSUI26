import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../app.js';
import { signToken } from '../middleware/auth.js';

describe('API integration', () => {
  let app: any;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health check works', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.programs).toBe(4);
  });

  it('lists programs', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/programs' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(4);
  });

  it('lists members with program relation', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/members?limit=2' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toHaveProperty('programId');
    expect(body.data[0]).toHaveProperty('major');
  });

  it('omits email and role on GET /api/v1/members without auth and with invalid token', async () => {
    const anonRes = await app.inject({ method: 'GET', url: '/api/v1/members?limit=2' });
    expect(anonRes.statusCode).toBe(200);
    const anonData = anonRes.json().data;
    expect(anonData).toHaveLength(2);
    for (const member of anonData) {
      expect(member).not.toHaveProperty('email');
      expect(member).not.toHaveProperty('role');
    }

    const badRes = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=2',
      headers: { cookie: 'token=garbage' },
    });
    expect(badRes.statusCode).toBe(200);
    for (const member of badRes.json().data) {
      expect(member).not.toHaveProperty('email');
      expect(member).not.toHaveProperty('role');
    }
  });

  it('includes email and role on GET /api/v1/members for whitelisted session', async () => {
    const token = signToken({ nama: 'Admin', npm: '2606888572' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=2',
      headers: { cookie: `token=${token}` },
    });
    expect(res.statusCode).toBe(200);
    const members = res.json().data;
    expect(members).toHaveLength(2);
    for (const member of members) {
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('role');
    }
  });

  it('rejects invalid email on PUT /api/v1/members/me with 400', async () => {
    const token = signToken({ nama: 'Admin', npm: '2606888572' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/members/me',
      headers: { cookie: `token=${token}` },
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('ignores role escalation and updates allowed fields on PUT /api/v1/members/me', async () => {
    const adminToken = signToken({ nama: 'Admin', npm: '2606888572' });
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=5',
      headers: { cookie: `token=${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const members = listRes.json().data;
    const target = members.find((m: any) => m.npm !== '2606888572') ?? members[0];
    const memberToken = signToken({ nama: target.name, npm: target.npm });

    try {
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/members/me',
        headers: { cookie: `token=${memberToken}` },
        payload: {
          role: 'admin',
          npm: '0000000000',
          nama_panggilan: 'UpdatedNick',
          programId: target.programId,
          email: target.email,
        },
      });
      expect(updateRes.statusCode).toBe(200);
      const updated = updateRes.json().data;
      expect(updated.npm).toBe(target.npm);
      expect(updated.nama_panggilan).toBe('UpdatedNick');
      expect(updated.role).toBe(target.role);
    } finally {
      await app.inject({
        method: 'PUT',
        url: '/api/v1/members/me',
        headers: { cookie: `token=${memberToken}` },
        payload: {
          nama_panggilan: target.nama_panggilan,
          programId: target.programId,
          email: target.email,
        },
      });
    }
  });

  it('returns 409 on duplicate email in PUT /api/v1/members/me', async () => {
    const adminToken = signToken({ nama: 'Admin', npm: '2606888572' });
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=2',
      headers: { cookie: `token=${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const [first, second] = listRes.json().data;
    const firstToken = signToken({ nama: first.name, npm: first.npm });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/members/me',
      headers: { cookie: `token=${firstToken}` },
      payload: { email: second.email },
    });
    expect(res.statusCode).toBe(409);
  });

  it('requires auth for protected member update', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/v1/members/123', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('requires auth for auth me', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('admin token can call admin endpoint validation', async () => {
    const token = signToken({ nama: 'Admin', npm: '2606888572', isAdmin: true, role: 'admin' });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/members/2606888572/role',
      headers: { cookie: `token=${token}` },
      payload: { role: 'invalid' },
    });
    expect([400, 403]).toContain(res.statusCode);
  });

  it('creates, moves across semesters, and deletes course with orphan semester pruning', async () => {
    const adminToken = signToken({ nama: 'Admin', npm: '2606888572' });
    const progRes = await app.inject({ method: 'GET', url: '/api/v1/programs' });
    expect(progRes.statusCode).toBe(200);
    const programId = progRes.json().data[0].id as string;

    let createdId: number | undefined;
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/courses',
        headers: { cookie: `token=${adminToken}` },
        payload: {
          programId,
          semester: 99,
          course: { name: 'Lifecycle Test Course', code: 'TEST99', sks: 3 },
        },
      });
      expect(createRes.statusCode).toBe(201);
      const created = createRes.json().data;
      expect(Number.isInteger(created.id)).toBe(true);
      expect(created.id).toBeGreaterThan(0);
      createdId = created.id;

      // No-op semester update must keep the active semester intact
      const noopMoveRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/courses/${createdId}`,
        headers: { cookie: `token=${adminToken}` },
        payload: { name: 'Lifecycle Test Renamed', semester: 99, programId },
      });
      expect(noopMoveRes.statusCode).toBe(200);
      expect(noopMoveRes.json().data.name).toBe('Lifecycle Test Renamed');

      const moveRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/courses/${createdId}`,
        headers: { cookie: `token=${adminToken}` },
        payload: { semester: 98, programId },
      });
      expect(moveRes.statusCode).toBe(200);

      const afterMoveSemRes = await app.inject({
        method: 'GET',
        url: `/api/v1/semesters?program=${encodeURIComponent(programId)}`,
      });
      expect(afterMoveSemRes.statusCode).toBe(200);
      const afterMoveSemesters = afterMoveSemRes.json().data;
      expect(afterMoveSemesters.some((s: any) => String(s.semester) === '99')).toBe(false);
      const sem98 = afterMoveSemesters.find((s: any) => String(s.semester) === '98');
      expect(sem98).toBeDefined();
      expect(sem98.courses.some((c: any) => c.id === createdId)).toBe(true);

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/courses/${createdId}`,
        headers: { cookie: `token=${adminToken}` },
      });
      expect(deleteRes.statusCode).toBe(200);
      createdId = undefined;

      const afterDeleteSemRes = await app.inject({
        method: 'GET',
        url: `/api/v1/semesters?program=${encodeURIComponent(programId)}`,
      });
      expect(afterDeleteSemRes.statusCode).toBe(200);
      expect(afterDeleteSemRes.json().data.some((s: any) => String(s.semester) === '98')).toBe(false);
    } finally {
      if (createdId !== undefined) {
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/courses/${createdId}`,
          headers: { cookie: `token=${adminToken}` },
        });
      }
    }
  });

  it('returns 409 on duplicate email in PUT /api/v1/members/:npm', async () => {
    const adminToken = signToken({ nama: 'Admin', npm: '2606888572' });
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=2',
      headers: { cookie: `token=${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const [first, second] = listRes.json().data;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/members/${first.npm}`,
      headers: { cookie: `token=${adminToken}` },
      payload: { email: second.email },
    });
    expect(res.statusCode).toBe(409);
  });

  it('clears token cookie on POST /api/v1/auth/logout and sets Secure in production', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toContain('token=;');
    expect(res.headers['set-cookie']).toContain('HttpOnly');

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prodRes = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
      expect(prodRes.statusCode).toBe(200);
      expect(prodRes.headers['set-cookie']).toContain('Secure');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('deduplicates repeated GET /api/v1/auth/callback requests for the same single-use CAS ticket', async () => {
    const originalFetch = globalThis.fetch;
    let casCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('sso.ui.ac.id/cas2/serviceValidate')) {
        casCalls += 1;
        if (casCalls === 1) {
          return new Response(
            `<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
              <cas:authenticationSuccess>
                <cas:user>vicky.ibrahimovic</cas:user>
                <cas:attributes>
                  <cas:nama>Vicky Ibrahimovic</cas:nama>
                  <cas:npm>2606888572</cas:npm>
                  <cas:kd_org>01.00.12.01</cas:kd_org>
                </cas:attributes>
              </cas:authenticationSuccess>
            </cas:serviceResponse>`,
            { status: 200, headers: { 'content-type': 'application/xml' } },
          );
        }
        return new Response(
          `<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
            <cas:authenticationFailure code='INVALID_TICKET'>
              ticket &#039;ST-217-ZIP3BvbfKpUAeCVy5EAy-sso.ui.ac.id&#039; not recognized
            </cas:authenticationFailure>
          </cas:serviceResponse>`,
          { status: 200, headers: { 'content-type': 'application/xml' } },
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const ticket = 'ST-217-ZIP3BvbfKpUAeCVy5EAy-sso.ui.ac.id';
      const firstRes = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/callback?ticket=${encodeURIComponent(ticket)}`,
      });
      expect(firstRes.statusCode).toBe(200);
      expect(firstRes.headers['set-cookie']).toContain('token=');
      expect(firstRes.json().data.user).toMatchObject({
        username: 'vicky.ibrahimovic',
        npm: '2606888572',
        org: expect.objectContaining({
          faculty: 'Fakultas Ilmu Komputer',
          studyProgram: 'Ilmu Komputer',
          programType: 'S1',
        }),
      });

      const secondRes = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/callback?ticket=${encodeURIComponent(ticket)}`,
      });
      expect(secondRes.statusCode).toBe(200);
      expect(secondRes.headers['set-cookie']).toContain('token=');
      expect(casCalls).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reflects PUT /api/v1/members/me updates immediately on GET /api/v1/members/:npm', async () => {
    const adminToken = signToken({ nama: 'Admin', npm: '2606888572' });
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=2',
      headers: { cookie: `token=${adminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const target = listRes.json().data[0];
    const memberToken = signToken({ nama: target.name, npm: target.npm });

    try {
      const updateRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/members/me',
        headers: { cookie: `token=${memberToken}` },
        payload: { niche: 'Systems Architecture' },
      });
      expect(updateRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/members/${target.npm}`,
        headers: { cookie: `token=${memberToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().data.niche).toBe('Systems Architecture');
    } finally {
      await app.inject({
        method: 'PUT',
        url: '/api/v1/members/me',
        headers: { cookie: `token=${memberToken}` },
        payload: { niche: target.niche },
      });
    }
  });
});