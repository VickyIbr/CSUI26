import { z } from 'zod';
import { ImageConfigSchema } from '@zenith/shared';
import type { Member } from '@/features/members/types';
import { normalizeMemberSocials } from '@/features/members/socialLinks';

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^https?:\/\/.+/.test(value),
    'URL must start with http:// or https://',
  );

export const memberFormSchema = z.object({
  npm: z.string().trim().regex(/^\d{10}$/, 'NPM must be 10 digits'),
  email: z.string().trim().email('Invalid email format'),
  name: z.string().trim().min(1, 'Name is required'),
  nama_panggilan: z.string().trim().min(1, 'Nickname is required'),
  programId: z.string().trim().min(1, 'Study program is required'),
  niche: z.string(),
  deskripsi: z.string(),
  quotes: z.string(),
  instagram: z.string(),
  line: z.string(),
  github: z.string(),
  linkedin: z.string(),
  fotoUrl: optionalUrl,
  fotoConfig: ImageConfigSchema.optional(),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export function toMemberPayload(values: MemberFormValues): Member {
  return normalizeMemberSocials({
    npm: values.npm,
    email: values.email,
    name: values.name,
    nama_panggilan: values.nama_panggilan,
    programId: values.programId,
    major: '',
    niche: values.niche,
    deskripsi: values.deskripsi,
    quotes: values.quotes,
    instagram: values.instagram,
    line: values.line,
    github: values.github,
    linkedin: values.linkedin,
    foto: {
      url: values.fotoUrl,
      ...(values.fotoConfig ? { config: values.fotoConfig } : {}),
    },
  });
}

