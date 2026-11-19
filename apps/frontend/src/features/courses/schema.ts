import { z } from 'zod';

export const courseFormSchema = z.object({
  programId: z.string().min(1, 'Program is required'),
  semester: z
    .string()
    .trim()
    .min(1, 'Semester is required')
    .refine((value) => /^\d+$/.test(value) && Number(value) > 0, 'Semester must be a positive number'),
  name: z.string().trim().min(1, 'Course name is required'),
  code: z.string(),
  sks: z
    .number({ message: 'SKS must be a number' })
    .int('SKS must be an integer')
    .min(1, 'Minimum 1 SKS')
    .max(6, 'Maximum 6 SKS'),
  description: z.string(),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

