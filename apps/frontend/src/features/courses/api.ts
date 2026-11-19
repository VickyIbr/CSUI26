import { api } from '@/lib/api';
import type { Course, CourseRow } from '@/features/courses/types';

export interface CoursePayload {
  programId: string;
  semester: string;
  course: Course;
}

export type CourseUpdatePayload = Course & {
  programId?: string;
  semester?: string | number;
};

export const coursesApi = {
  create: (payload: CoursePayload) =>
    api<{ data: CourseRow }>('/courses', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: number, payload: CourseUpdatePayload) =>
    api<{ data: CourseRow }>(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  remove: (id: number) => api<void>(`/courses/${id}`, { method: 'DELETE' }),
};
