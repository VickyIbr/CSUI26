import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../app.js';
import { signToken } from '../middleware/auth.js';

const WEBP_1X1 = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x11, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
  0x05, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00, 0x00,
]);

function buildMultipartBody(
  filename: string,
  contentType: string,
  content: Buffer,
  boundary = '----ZenithTestBoundary',
) {
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([header, content, footer]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('Achievements & Upload API integration', () => {
  let app: ReturnType<typeof createApp>;
  let prevS3Endpoint: string | undefined;
  let memberOne: { npm: string; name: string };
  let memberTwo: { npm: string; name: string };
  const adminToken = signToken({ nama: 'Admin', npm: '2606888572' });
  const createdIds: string[] = [];

  beforeAll(async () => {
    prevS3Endpoint = process.env.S3_ENDPOINT;
    delete process.env.S3_ENDPOINT;
    app = createApp();
    await app.ready();

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/members?limit=5',
      headers: { cookie: `token=${adminToken}` },
    });
    const nonAdmins = (listRes.json().data as Array<{ npm: string; name: string; role?: string }>).filter(
      (m) => m.npm !== '2606888572' && m.role !== 'admin',
    );
    memberOne = nonAdmins[0];
    memberTwo = nonAdmins[1] ?? nonAdmins[0];
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/achievements/${id}`,
        headers: { cookie: `token=${adminToken}` },
      });
    }
    if (prevS3Endpoint !== undefined) {
      process.env.S3_ENDPOINT = prevS3Endpoint;
    }
    await app.close();
  });

  it('allows public GET /api/v1/achievements and ?format=grouped without auth', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/achievements' });
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.json().data)).toBe(true);

    const groupedRes = await app.inject({ method: 'GET', url: '/api/v1/achievements?format=grouped' });
    expect(groupedRes.statusCode).toBe(200);
    expect(groupedRes.json().data).toHaveProperty('latestAchievements');
    expect(groupedRes.json().data).toHaveProperty('yearlyAchievementsByYear');
  });

  it('enforces auth, admin RBAC, and featured validation on POST /api/v1/achievements', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/v1/achievements',
      payload: { id: 'test-unauth', title: 'Test', year: 2026, isFeatured: false },
    });
    expect(unauth.statusCode).toBe(401);

    const userToken = signToken({ nama: memberOne.name, npm: memberOne.npm });
    const nonAdmin = await app.inject({
      method: 'POST',
      url: '/api/v1/achievements',
      headers: { cookie: `token=${userToken}` },
      payload: { id: 'test-forbidden', title: 'Test', year: 2026, isFeatured: false },
    });
    expect(nonAdmin.statusCode).toBe(403);

    const invalidFeatured = await app.inject({
      method: 'POST',
      url: '/api/v1/achievements',
      headers: { cookie: `token=${adminToken}` },
      payload: { id: 'test-bad-featured', title: 'Incomplete', year: 2024, isFeatured: true },
    });
    expect(invalidFeatured.statusCode).toBe(400);

    const validFeatured = await app.inject({
      method: 'POST',
      url: '/api/v1/achievements',
      headers: { cookie: `token=${adminToken}` },
      payload: {
        id: 'test-feat-1',
        title: 'IOAI Winner',
        award: 'JUARA 1',
        year: 2024,
        isFeatured: true,
        image: { url: 'https://cdn.csui.dev/achievements/test-feat-1.webp', config: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: '16:9' } },
        teamName: 'Team Zenith',
        members: ["Alpha IK'26"],
        description: 'Won gold medal.',
        showOverlay: false,
      },
    });
    expect(validFeatured.statusCode).toBe(201);
    createdIds.push('test-feat-1');
    expect(validFeatured.json().data.id).toBe('test-feat-1');
  });

  it('invalidates grouped cache on PUT and DELETE /api/v1/achievements/:id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/achievements',
      headers: { cookie: `token=${adminToken}` },
      payload: { id: 'test-year-1', title: 'Original Year Title', year: 2029, isFeatured: false },
    });
    expect(createRes.statusCode).toBe(201);
    createdIds.push('test-year-1');

    const primeRes = await app.inject({ method: 'GET', url: '/api/v1/achievements?format=grouped' });
    expect(primeRes.statusCode).toBe(200);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/v1/achievements/test-year-1',
      headers: { cookie: `token=${adminToken}` },
      payload: { title: 'Updated Year Title' },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().data.title).toBe('Updated Year Title');

    const afterPut = await app.inject({ method: 'GET', url: '/api/v1/achievements?format=grouped' });
    const year2029 = (afterPut.json().data.yearlyAchievementsByYear as Array<{ year: number; items: Array<{ id: string; title: string }> }>).find(
      (g) => g.year === 2029,
    );
    expect(year2029?.items.some((i) => i.id === 'test-year-1' && i.title === 'Updated Year Title')).toBe(true);

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/achievements/test-year-1',
      headers: { cookie: `token=${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    const getDeleted = await app.inject({ method: 'GET', url: '/api/v1/achievements/test-year-1' });
    expect(getDeleted.statusCode).toBe(404);
  });

  it('enforces self-upload RBAC and magic-byte validation on POST /api/v1/upload/avatar', async () => {
    const userToken = signToken({ nama: memberOne.name, npm: memberOne.npm });

    const validUpload = buildMultipartBody('avatar.webp', 'image/webp', WEBP_1X1);
    const selfRes = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/avatar',
      headers: { cookie: `token=${userToken}`, 'content-type': validUpload.contentType },
      payload: validUpload.payload,
    });
    expect(selfRes.statusCode).toBe(200);
    expect(selfRes.json().data.key).toMatch(new RegExp(`^members/${memberOne.npm}-\\d+\\.webp$`));
    expect(selfRes.json().data.width).toBe(1);

    if (memberTwo.npm !== memberOne.npm) {
      const otherUpload = buildMultipartBody('avatar.webp', 'image/webp', WEBP_1X1);
      const idorRes = await app.inject({
        method: 'POST',
        url: `/api/v1/upload/avatar?npm=${memberTwo.npm}`,
        headers: { cookie: `token=${userToken}`, 'content-type': otherUpload.contentType },
        payload: otherUpload.payload,
      });
      expect(idorRes.statusCode).toBe(403);
    }

    const spoofed = buildMultipartBody(
      'xss.webp',
      'image/webp',
      Buffer.from('<!DOCTYPE html><script>alert(1)</script>'),
    );
    const spoofRes = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/avatar',
      headers: { cookie: `token=${userToken}`, 'content-type': spoofed.contentType },
      payload: spoofed.payload,
    });
    expect(spoofRes.statusCode).toBe(415);
  });

  it('enforces admin-only RBAC on POST /api/v1/upload/achievement', async () => {
    const userToken = signToken({ nama: memberOne.name, npm: memberOne.npm });
    const reqBody = buildMultipartBody('banner.webp', 'image/webp', WEBP_1X1);

    const nonAdminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/achievement?id=ioai-2024',
      headers: { cookie: `token=${userToken}`, 'content-type': reqBody.contentType },
      payload: reqBody.payload,
    });
    expect(nonAdminRes.statusCode).toBe(403);

    const adminBody = buildMultipartBody('banner.webp', 'image/webp', WEBP_1X1);
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/achievement?id=ioai-2024',
      headers: { cookie: `token=${adminToken}`, 'content-type': adminBody.contentType },
      payload: adminBody.payload,
    });
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.json().data.key).toMatch(/^achievements\/ioai-2024-\d+\.webp$/);
  });
});
