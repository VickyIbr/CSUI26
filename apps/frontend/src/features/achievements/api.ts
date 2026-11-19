import { api } from '@/lib/api';
import type {
  Achievement,
  AchievementCreate,
  PublicAchievementsResponse,
} from '@zenith/shared';

export const achievementsApi = {
  listGrouped: () => api<{ data: PublicAchievementsResponse }>('/achievements?format=grouped'),
  create: (payload: AchievementCreate) =>
    api<{ data: Achievement }>('/achievements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: Partial<AchievementCreate>) =>
    api<{ data: Achievement }>(`/achievements/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    api<void>(`/achievements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
