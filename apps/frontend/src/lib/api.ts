const BASE = '/api/v1';

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Response body is not JSON; keep the status text.
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface UploadedMedia {
  url: string;
  key: string;
  width: number;
  height: number;
  mime: string;
  size: number;
}

export async function uploadMedia(
  endpoint: '/upload/avatar' | '/upload/achievement',
  blob: Blob,
  params?: Record<string, string>,
): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('file', blob, 'image.webp');
  const query = params && Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await api<{ data: UploadedMedia }>(`${endpoint}${query}`, {
    method: 'POST',
    body: form,
  });
  return res.data;
}
