import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Member } from '../../schemas/index.js';
import { invalidateMemberAuthCache } from '../../middleware/auth.js';
import { db } from '../client.js';
import { members, programs } from '../schema.js';

function mapMemberRow(row: typeof members.$inferSelect, programName?: string | null): Member {
  return {
    npm: row.npm,
    email: row.email,
    name: row.name,
    nama_panggilan: row.namaPanggilan,
    major: programName || row.programId,
    programId: row.programId,
    instagram: row.instagram ?? '',
    line: row.line ?? '',
    github: row.github ?? '',
    linkedin: row.linkedin ?? '',
    deskripsi: row.deskripsi ?? '',
    niche: row.niche ?? '',
    quotes: row.quotes ?? '',
    foto: row.foto,
    role: row.role === 'admin' ? 'admin' : 'user',
  };
}

function buildMemberConditions(params: { search?: string; major?: string; program?: string; niche?: string }): SQL[] {
  const conditions: SQL[] = [];
  if (params.program) conditions.push(eq(members.programId, params.program));
  if (params.major) {
    const match = or(
      eq(members.programId, params.major),
      sql`lower(${programs.name}) = ${params.major.toLowerCase()}`,
    );
    if (match) conditions.push(match);
  }
  if (params.niche) conditions.push(ilike(members.niche, `%${params.niche}%`));
  if (params.search) {
    const search = `%${params.search}%`;
    const lowered = `%${params.search.toLowerCase()}%`;
    const match = or(
      ilike(members.name, lowered),
      ilike(members.namaPanggilan, lowered),
      ilike(members.npm, search),
      ilike(members.email, lowered),
    );
    if (match) conditions.push(match);
  }
  return conditions;
}

export async function getAllMembers(
  params: { search?: string; major?: string; program?: string; niche?: string; limit?: number; offset?: number } = {},
): Promise<Member[]> {
  const conditions = buildMemberConditions(params);

  let query = db
    .select({ m: members, programName: programs.name })
    .from(members)
    .leftJoin(programs, eq(members.programId, programs.id))
    .$dynamic();

  if (conditions.length) query = query.where(and(...conditions));
  query = query.orderBy(asc(members.name));
  if (params.limit !== undefined) {
    query = query.limit(params.limit).offset(params.offset ?? 0);
  }

  const rows = await query;
  return rows.map((row) => mapMemberRow(row.m, row.programName));
}

export async function countMembers(
  params: { search?: string; major?: string; program?: string; niche?: string } = {},
): Promise<number> {
  const conditions = buildMemberConditions(params);

  let query = db
    .select({ total: sql<number>`count(*)` })
    .from(members)
    .leftJoin(programs, eq(members.programId, programs.id))
    .$dynamic();

  if (conditions.length) query = query.where(and(...conditions));
  const rows = await query;
  return Number(rows[0]?.total ?? 0);
}

export async function getMemberByNpm(npm: string): Promise<Member | null> {
  const rows = await db
    .select({ m: members, programName: programs.name })
    .from(members)
    .leftJoin(programs, eq(members.programId, programs.id))
    .where(eq(members.npm, npm));
  const row = rows[0];
  if (!row) return null;
  return mapMemberRow(row.m, row.programName);
}

async function resolveProgramId(value?: string): Promise<string | null> {
  if (!value) return null;
  const rows = await db
    .select({ id: programs.id })
    .from(programs)
    .where(or(eq(programs.id, value), eq(programs.name, value)));
  return rows[0]?.id ?? null;
}

export async function createMember(member: Member): Promise<Member> {
  const programId = await resolveProgramId(member.programId ?? member.major);
  if (!programId) throw new Error('Program not found');

  await db.insert(members).values({
    npm: member.npm,
    email: member.email,
    name: member.name,
    namaPanggilan: member.nama_panggilan,
    programId,
    instagram: member.instagram || '',
    line: member.line || '',
    github: member.github || '',
    linkedin: member.linkedin || '',
    deskripsi: member.deskripsi || '',
    niche: member.niche || '',
    quotes: member.quotes || '',
    foto: member.foto,
    role: member.role || 'user',
  });
  invalidateMemberAuthCache(member.npm);
  return (await getMemberByNpm(member.npm))!;
}

export async function updateMember(npm: string, updates: Partial<Member>): Promise<Member | null> {
  const existing = await getMemberByNpm(npm);
  if (!existing) return null;

  const set: Record<string, unknown> = {};
  if (updates.email !== undefined) set.email = updates.email;
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.nama_panggilan !== undefined) set.namaPanggilan = updates.nama_panggilan;
  if (updates.programId !== undefined || updates.major !== undefined) {
    const programId = await resolveProgramId(updates.programId ?? updates.major);
    if (!programId) throw new Error('Program not found');
    set.programId = programId;
  }
  if (updates.instagram !== undefined) set.instagram = updates.instagram;
  if (updates.line !== undefined) set.line = updates.line;
  if (updates.github !== undefined) set.github = updates.github;
  if (updates.linkedin !== undefined) set.linkedin = updates.linkedin;
  if (updates.deskripsi !== undefined) set.deskripsi = updates.deskripsi;
  if (updates.niche !== undefined) set.niche = updates.niche;
  if (updates.quotes !== undefined) set.quotes = updates.quotes;
  if (updates.foto !== undefined) set.foto = updates.foto;

  if (Object.keys(set).length > 0) {
    set.updatedAt = sql`extract(epoch from now())::int`;
    await db.update(members).set(set).where(eq(members.npm, npm));
    invalidateMemberAuthCache(npm);
  }
  return getMemberByNpm(npm);
}

export async function deleteMember(npm: string): Promise<boolean> {
  const result = await db.delete(members).where(eq(members.npm, npm)).returning({ npm: members.npm });
  if (result.length > 0) {
    invalidateMemberAuthCache(npm);
    return true;
  }
  return false;
}

export async function updateMemberRole(npm: string, newRole: 'user' | 'admin'): Promise<Member | null> {
  const member = await getMemberByNpm(npm);
  if (!member) return null;

  const adminNPMs = (process.env.ADMIN_NPM_LIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (adminNPMs.includes(npm) && newRole !== 'admin') {
    return null;
  }

  await db
    .update(members)
    .set({ role: newRole, updatedAt: sql`extract(epoch from now())::int` })
    .where(eq(members.npm, npm));
  invalidateMemberAuthCache(npm);
  return getMemberByNpm(npm);
}
