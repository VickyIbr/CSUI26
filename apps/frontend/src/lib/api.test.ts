import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, uploadMedia } from '@/lib/api';

describe('api client and uploadMedia', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets Content-Type application/json for JSON bodies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );

    await api('/members', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/members');
    const headers = init?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('preserves FormData boundary without setting Content-Type on uploadMedia', async () => {
    const uploaded = {
      url: 'https://cdn.csui.dev/members/2606887550-1.webp',
      key: 'members/2606887550-1.webp',
      width: 400,
      height: 400,
      mime: 'image/webp',
      size: 1234,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: uploaded }), { status: 200 }),
    );

    const blob = new Blob(['webp'], { type: 'image/webp' });
    const result = await uploadMedia('/upload/avatar', blob, { npm: '2606887550' });

    expect(result).toEqual(uploaded);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/upload/avatar?npm=2606887550');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    const headers = init?.headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('omits query string when uploadMedia has no params', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { url: 'https://cdn.csui.dev/a.webp', key: 'a.webp', width: 10, height: 10, mime: 'image/webp', size: 10 } }), { status: 200 }),
    );

    await uploadMedia('/upload/achievement', new Blob(['webp'], { type: 'image/webp' }));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/upload/achievement');
  });
});
