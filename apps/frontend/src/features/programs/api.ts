import { api } from '@/lib/api';
import type { Program, ProgramPayload } from '@/features/programs/types';

export const programsApi = {
  list: () => api<{ data: Program[] }>('/programs'),
  create: (payload: ProgramPayload) =>
    api<{ data: Program }>('/programs', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: ProgramPayload) =>
    api<{ data: Program }>(`/programs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => api<void>(`/programs/${id}`, { method: 'DELETE' }),
};
