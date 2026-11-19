import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^https?:\/\/.+/.test(value),
    'URL must start with http:// or https://',
  );

export const programFormSchema = z.object({
  id: z.string().trim().min(1, 'ID is required'),
  name: z.string().trim().min(1, 'Name is required'),
  slug: z.string().trim().min(1, 'Slug is required'),
  description: z.string(),
  careers: z.string(),
  courseMapUrl: optionalUrl,
  driveUrl: optionalUrl,
});

export type ProgramFormValues = z.infer<typeof programFormSchema>;

