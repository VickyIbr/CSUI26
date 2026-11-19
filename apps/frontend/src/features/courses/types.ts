import type { Course } from '@zenith/shared';

export type { Course };

export interface CourseRow {
  programId: string;
  programName: string;
  semester: number | string;
  course: Course;
}

export interface ProgramOption {
  id: string;
  name: string;
}
