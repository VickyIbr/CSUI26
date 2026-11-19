import type { Program, Semester } from '@zenith/shared';

export type { Program, Semester };
export type ProgramPayload = Omit<Program, 'semesters'> & { semesters: Semester[] };
