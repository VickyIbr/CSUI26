import { api } from '@/lib/api';
import type { Member } from '@/features/members/types';

export const membersApi = {
  get: (npm: string) =>
    api<{ data: Member }>(`/members/${npm}`),
  getMe: () =>
    api<{ data: Member }>('/members/me'),
  create: (payload: Member) =>
    api<{ data: Member }>('/members', { method: 'POST', body: JSON.stringify(payload) }),
  update: (npm: string, payload: Partial<Member>) =>
    api<{ data: Member }>(`/members/${npm}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateMe: (payload: Partial<Member>) =>
    api<{ data: Member }>('/members/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateRole: (npm: string, role: 'user' | 'admin') =>
    api<{ data: Member }>(`/members/${npm}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  remove: (npm: string) => api<void>(`/members/${npm}`, { method: 'DELETE' }),
};
