import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Program, ProgramCreate, Semester } from '../../schemas/index.js';
import { createTtlCache } from '../../lib/cache.js';
import { db, type DbExecutor } from '../client.js';
import { courses, programs, semesters } from '../schema.js';
import { insertCourseWithExecutor, mapCourseRow } from './courses.js';

const curriculumCache = createTtlCache<unknown>(60_000);

export function invalidateCurriculumCache(): void {
  curriculumCache.clear();
}

async function buildSemestersMap(
  semRows: (typeof semesters.$inferSelect)[],
  executor: DbExecutor = db,
): Promise<Map<string, Semester[]>> {
  const semsByProgram = new Map<string, Semester[]>();
  if (!semRows.length) return semsByProgram;

  const courseRows = await executor
    .select()
    .from(courses)
    .where(inArray(courses.semesterId, semRows.map((row) => row.id)))
    .orderBy(asc(courses.position));

  const coursesBySem = new Map<number, ReturnType<typeof mapCourseRow>[]>();
  for (const row of courseRows) {
    const list = coursesBySem.get(row.semesterId) ?? [];
    list.push(mapCourseRow(row));
    coursesBySem.set(row.semesterId, list);
  }

  for (const row of semRows) {
    const list = semsByProgram.get(row.programId) ?? [];
    list.push({
      semester: isNaN(Number(row.semester)) ? row.semester : Number(row.semester),
      courses: coursesBySem.get(row.id) ?? [],
    });
    semsByProgram.set(row.programId, list);
  }

  return semsByProgram;
}

async function hydratePrograms(
  programRows: (typeof programs.$inferSelect)[],
  executor: DbExecutor = db,
): Promise<Program[]> {
  if (!programRows.length) return [];

  const programIds = programRows.map((row) => row.id);
  const semRows = await executor
    .select()
    .from(semesters)
    .where(inArray(semesters.programId, programIds))
    .orderBy(asc(semesters.position));
  const semsByProgram = await buildSemestersMap(semRows, executor);

  return programRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    careers: row.careers ?? [],
    courseMapUrl: row.courseMapUrl,
    driveUrl: row.driveUrl,
    semesters: semsByProgram.get(row.id) ?? [],
  }));
}

export async function countPrograms(): Promise<number> {
  const rows = await db.select({ total: sql<number>`count(*)` }).from(programs);
  return Number(rows[0]?.total ?? 0);
}

export async function getAllPrograms(): Promise<Program[]> {
  const cached = curriculumCache.get('programs:all') as Program[] | undefined;
  if (cached) return cached;

  const programRows = await db.select().from(programs).orderBy(asc(programs.name));
  const hydrated = await hydratePrograms(programRows);
  curriculumCache.set('programs:all', hydrated);
  return hydrated;
}

export async function getProgramById(id: string, executor: DbExecutor = db): Promise<Program | null> {
  const rows = await executor.select().from(programs).where(eq(programs.id, id));
  if (!rows.length) return null;
  const hydrated = await hydratePrograms(rows, executor);
  return hydrated[0] ?? null;
}

export async function createProgram(program: ProgramCreate): Promise<Program> {
  const created = await db.transaction(async (tx) => {
    await tx.insert(programs).values({
      id: program.id,
      name: program.name,
      slug: program.slug,
      description: program.description,
      careers: program.careers,
      courseMapUrl: program.courseMapUrl,
      driveUrl: program.driveUrl,
    });

    for (const sem of program.semesters ?? []) {
      for (const course of sem.courses) {
        await insertCourseWithExecutor(program.id, sem.semester, course, tx);
      }
    }

    return (await getProgramById(program.id, tx))!;
  });

  invalidateCurriculumCache();
  return created;
}

export async function updateProgram(id: string, updates: Partial<Program>): Promise<Program | null> {
  const existing = await getProgramById(id);
  if (!existing) return null;

  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.slug !== undefined) set.slug = updates.slug;
  if (updates.description !== undefined) set.description = updates.description;
  if (updates.careers !== undefined) set.careers = updates.careers;
  if (updates.courseMapUrl !== undefined) set.courseMapUrl = updates.courseMapUrl;
  if (updates.driveUrl !== undefined) set.driveUrl = updates.driveUrl;
  if (Object.keys(set).length > 0) {
    set.updatedAt = sql`extract(epoch from now())::int`;
    await db.update(programs).set(set).where(eq(programs.id, id));
    invalidateCurriculumCache();
  }
  return getProgramById(id);
}

export async function deleteProgram(id: string): Promise<boolean> {
  const result = await db.delete(programs).where(eq(programs.id, id)).returning({ id: programs.id });
  if (result.length > 0) {
    invalidateCurriculumCache();
    return true;
  }
  return false;
}

async function getSemestersByProgram(programId: string): Promise<Semester[]> {
  const semRows = await db
    .select()
    .from(semesters)
    .where(eq(semesters.programId, programId))
    .orderBy(asc(semesters.position));
  return (await buildSemestersMap(semRows)).get(programId) ?? [];
}

export async function getAllSemesters(programId?: string) {
  const cacheKey = programId ? `semesters:${programId}` : 'semesters:all';
  const cached = curriculumCache.get(cacheKey);
  if (cached) return cached;

  const result = programId
    ? await getSemestersByProgram(programId)
    : (await getAllPrograms()).flatMap((p) => p.semesters.map((s) => ({ ...s, programId: p.id, programName: p.name })));

  curriculumCache.set(cacheKey, result);
  return result;
}
