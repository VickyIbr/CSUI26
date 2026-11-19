import { describe, expect, it } from 'vitest';
import { memberFormSchema, toMemberPayload } from '@/features/members/schema';
import type { MemberFormValues } from '@/features/members/schema';

const valid: MemberFormValues = {
  npm: '1234567890',
  email: 'budi@ui.ac.id',
  name: 'Budi Santoso',
  nama_panggilan: 'Budi',
  programId: 'ilmu-komputer',
  niche: 'Backend',
  deskripsi: 'Description',
  quotes: 'Quote',
  instagram: 'budi',
  line: 'budi',
  github: 'budi',
  linkedin: 'budi',
  fotoUrl: 'https://example.com/foto.jpg',
};

describe('memberFormSchema', () => {
  it('menerima data valid', () => {
    expect(memberFormSchema.safeParse(valid).success).toBe(true);
  });

  it('menolak NPM bukan 10 digit', () => {
    const result = memberFormSchema.safeParse({ ...valid, npm: '12345' });
    expect(result.success).toBe(false);
  });

  it('menolak email salah format', () => {
    const result = memberFormSchema.safeParse({ ...valid, email: 'bukan-email' });
    expect(result.success).toBe(false);
  });

  it('menolak URL foto bukan http', () => {
    const result = memberFormSchema.safeParse({ ...valid, fotoUrl: 'ftp://x' });
    expect(result.success).toBe(false);
  });

  it('menerima foto URL kosong', () => {
    expect(memberFormSchema.safeParse({ ...valid, fotoUrl: '' }).success).toBe(true);
  });
});

describe('toMemberPayload', () => {
  it('memetakan form values ke bentuk Member', () => {
    const payload = toMemberPayload(valid);
    expect(payload.npm).toBe('1234567890');
    expect(payload.foto.url).toBe('https://example.com/foto.jpg');
    expect(payload.nama_panggilan).toBe('Budi');
  });
});
