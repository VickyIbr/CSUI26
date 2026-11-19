import { z } from 'zod';

const optionalImageUrl = z
  .string()
  .refine(
    (value) => value === '' || /^(https?:\/\/|\/)/.test(value),
    'Image URL must start with http://, https://, or /',
  );

// Shared image transform configuration
export const ImageConfigSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
  rotate: z.number().optional(),
  aspect: z.string(),
});

export const ImageFieldSchema = z.object({
  url: optionalImageUrl,
  config: ImageConfigSchema.optional(),
});

// Program schemas
export const CourseSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, 'Course name required'),
  code: z.string().optional(),
  sks: z.number().int().min(1).max(6),
  description: z.string().optional(),
  prerequisites: z.array(z.string()).optional(),
  materialUrl: z.string().url().optional().or(z.literal('')),
});

export const SemesterSchema = z.object({
  semester: z.union([z.number().int().positive(), z.string()]),
  courses: z.array(CourseSchema),
});

export const ProgramSchema = z.object({
  id: z.string().min(1, 'Program ID required'),
  name: z.string().min(1, 'Program name required'),
  slug: z.string().min(1),
  description: z.string(),
  careers: z.array(z.string()),
  courseMapUrl: z.string().url().or(z.literal('')),
  driveUrl: z.string().url().or(z.literal('')),
  semesters: z.array(SemesterSchema),
});

export const ProgramCreateSchema = ProgramSchema.extend({
  semesters: z.array(SemesterSchema).optional().default([]),
});
export const ProgramUpdateSchema = ProgramSchema.partial().omit({ id: true });

// Course CRUD schemas
export const CourseCreateSchema = z.object({
  programId: z.string().min(1),
  semester: z.union([z.number().int().positive(), z.string()]),
  course: CourseSchema,
});

export const CourseUpdateSchema = CourseSchema.partial().extend({
  programId: z.string().min(1).optional(),
  semester: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
});

// Member schemas
export const MemberFotoSchema = ImageFieldSchema;

export const MemberSchema = z.object({
  npm: z.string().regex(/^\d{10}$/, 'NPM must be 10 digits'),
  email: z.string().email(),
  name: z.string().min(1),
  nama_panggilan: z.string().min(1),
  major: z.string().optional(),
  programId: z.string().min(1).optional(),
  instagram: z.string(),
  line: z.string(),
  github: z.string(),
  linkedin: z.string(),
  deskripsi: z.string(),
  niche: z.string(),
  quotes: z.string(),
  foto: MemberFotoSchema,
  role: z.enum(['user', 'admin']).optional(),
});

export const MemberCreateSchema = MemberSchema;
export const MemberUpdateSchema = MemberSchema.partial().omit({ npm: true });

export const MemberRoleUpdateSchema = z.object({
  role: z.enum(['user', 'admin']),
});

// Achievement schemas
const AchievementFields = {
  id: z.string().min(1, 'Achievement ID required'),
  title: z.string().min(1, 'Title required'),
  award: z.string().optional(),
  year: z.number().int().min(1990).max(2100),
  isFeatured: z.boolean(),
  image: ImageFieldSchema.optional(),
  teamName: z.string().optional(),
  members: z.array(z.string()).optional(),
  description: z.string().optional(),
  showOverlay: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
};

export const AchievementSchema = z.object({
  id: z.string().min(1, 'Achievement ID required'),
  title: z.string().min(1, 'Title required'),
  award: z.string(),
  year: z.number().int().min(1990).max(2100),
  isFeatured: z.boolean(),
  image: ImageFieldSchema,
  teamName: z.string(),
  members: z.array(z.string()),
  description: z.string(),
  showOverlay: z.boolean(),
  position: z.number().int().min(0),
});

export const AchievementCreateSchema = z
  .object({
    id: AchievementFields.id,
    title: AchievementFields.title,
    award: z.string().default(''),
    year: AchievementFields.year,
    isFeatured: z.boolean().default(false),
    image: ImageFieldSchema.default({ url: '' }),
    teamName: z.string().default(''),
    members: z.array(z.string()).default([]),
    description: z.string().default(''),
    showOverlay: z.boolean().default(true),
    position: z.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    if (!data.isFeatured) return;

    if (!data.award.trim()) {
      ctx.addIssue({ code: 'custom', path: ['award'], message: 'Award is required for featured achievements' });
    }
    if (!data.image.url.trim()) {
      ctx.addIssue({ code: 'custom', path: ['image', 'url'], message: 'Image URL is required for featured achievements' });
    }
    if (!data.teamName.trim()) {
      ctx.addIssue({ code: 'custom', path: ['teamName'], message: 'Team name is required for featured achievements' });
    }
    if (data.members.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['members'], message: 'At least one team member is required' });
    }
    if (!data.description.trim()) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Description is required for featured achievements' });
    }
  });

export const AchievementUpdateSchema = z.object(AchievementFields).omit({ id: true }).partial();

export const LatestAchievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  award: z.string(),
  image: z.string(),
  imageConfig: ImageConfigSchema.optional(),
  teamName: z.string(),
  members: z.array(z.string()),
  description: z.string(),
  showOverlay: z.boolean().optional(),
});

export const YearlyAchievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  award: z.string().optional(),
  year: z.number().int(),
});

export const YearGroupSchema = z.object({
  year: z.number().int(),
  items: z.array(YearlyAchievementSchema),
});

export const PublicAchievementsResponseSchema = z.object({
  latestAchievements: z.array(LatestAchievementSchema),
  yearlyAchievementsByYear: z.array(YearGroupSchema),
});

// Types
export type ImageConfig = z.infer<typeof ImageConfigSchema>;
export type ImageField = z.infer<typeof ImageFieldSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type Semester = z.infer<typeof SemesterSchema>;
export type Program = z.infer<typeof ProgramSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type CourseCreate = z.infer<typeof CourseCreateSchema>;
export type CourseUpdate = z.infer<typeof CourseUpdateSchema>;
export type ProgramCreate = z.infer<typeof ProgramCreateSchema>;
export type ProgramUpdate = z.infer<typeof ProgramUpdateSchema>;
export type MemberCreate = z.infer<typeof MemberCreateSchema>;
export type MemberUpdate = z.infer<typeof MemberUpdateSchema>;
export type Achievement = z.infer<typeof AchievementSchema>;
export type AchievementCreate = z.infer<typeof AchievementCreateSchema>;
export type AchievementUpdate = z.infer<typeof AchievementUpdateSchema>;
export type LatestAchievement = z.infer<typeof LatestAchievementSchema>;
export type YearlyAchievement = z.infer<typeof YearlyAchievementSchema>;
export type YearGroup = z.infer<typeof YearGroupSchema>;
export type PublicAchievementsResponse = z.infer<typeof PublicAchievementsResponseSchema>;
