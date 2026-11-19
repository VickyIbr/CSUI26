import { z } from 'zod';
import { ImageConfigSchema, type AchievementCreate } from '@zenith/shared';

function splitMembersText(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const optionalImageUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^(https?:\/\/|\/)/.test(value),
    'Image URL must start with http://, https://, or /',
  );

export const achievementFormSchema = z
  .object({
    id: z.string().trim().min(1, 'ID is required'),
    title: z.string().trim().min(1, 'Title is required'),
    year: z
      .number({ message: 'Year must be a number' })
      .int('Year must be an integer')
      .min(1990, 'Minimum year is 1990')
      .max(2100, 'Maximum year is 2100'),
    isFeatured: z.boolean(),
    award: z.string(),
    teamName: z.string(),
    membersText: z.string(),
    description: z.string(),
    showOverlay: z.boolean(),
    imageUrl: optionalImageUrl,
    imageConfig: ImageConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isFeatured) return;

    if (!data.award.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['award'],
        message: 'Award is required for featured achievements',
      });
    }
    if (!data.imageUrl.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['imageUrl'],
        message: 'Image URL is required for featured achievements',
      });
    }
    if (!data.teamName.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['teamName'],
        message: 'Team name is required for featured achievements',
      });
    }
    if (splitMembersText(data.membersText).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['membersText'],
        message: 'At least one team member is required',
      });
    }
    if (!data.description.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Description is required for featured achievements',
      });
    }
  });

export type AchievementFormValues = z.infer<typeof achievementFormSchema>;

export function toAchievementPayload(values: AchievementFormValues): AchievementCreate {
  return {
    id: values.id.trim(),
    title: values.title.trim(),
    year: values.year,
    isFeatured: values.isFeatured,
    award: values.award.trim(),
    teamName: values.teamName.trim(),
    members: splitMembersText(values.membersText),
    description: values.description.trim(),
    showOverlay: values.showOverlay,
    image: {
      url: values.imageUrl.trim(),
      ...(values.imageConfig ? { config: values.imageConfig } : {}),
    },
    position: 0,
  };
}
