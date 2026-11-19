import { and, asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Course, CourseUpdate } from '../../schemas/index.js';
import { db, type DbExecutor } from '../client.js';
import { courses, programs, semesters } from '../schema.js';
import { invalidateCurriculumCache } from './programs.js';

export function mapCourseRow(row: typeof courses.$inferSelect): Course {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    sks: row.sks,
    description: row.description ?? undefined,
    prerequisites: row.prerequisites ?? undefined,
    materialUrl: row.materialUrl ?? undefined,
  };
}

export async function getOrCreateSemesterId(
  programId: string,
  semester: string | number,
  tx: DbExecutor = db,
): Promise<number> {
  const semKey = String(semester).trim();
  const semRows = await tx
    .select()
    .from(semesters)
    .where(and(eq(semesters.programId, programId), eq(semesters.semester, semKey)));
  if (semRows.length) return semRows[0].id;

  const maxRows = await tx
    .select({ pos: sql<number>`coalesce(max(${semesters.position}), -1) + 1` })
    .from(semesters)
    .where(eq(semesters.programId, programId));
  const inserted = await tx
    .insert(semesters)
    .values({
      programId,
      semester: semKey,
      position: Number(maxRows[0]?.pos ?? 0),
    })
    .returning({ id: semesters.id });
  return inserted[0].id;
}

export async function getNextCoursePosition(semesterId: number, tx: DbExecutor = db): Promise<number> {
  const maxCourseRows = await tx
    .select({ pos: sql<number>`coalesce(max(${courses.position}), -1) + 1` })
    .from(courses)
    .where(eq(courses.semesterId, semesterId));
  return Number(maxCourseRows[0]?.pos ?? 0);
}

export async function pruneSemesterIfEmpty(semesterId: number, tx: DbExecutor = db): Promise<void> {
  const rows = await tx
    .select({ total: sql<number>`count(*)` })
    .from(courses)
    .where(eq(courses.semesterId, semesterId));
  if (Number(rows[0]?.total ?? 0) === 0) {
    await tx.delete(semesters).where(eq(semesters.id, semesterId));
  }
}

export async function insertCourseWithExecutor(
  programId: string,
  semester: string | number,
  course: Course,
  tx: DbExecutor = db,
): Promise<Course> {
  const semesterId = await getOrCreateSemesterId(programId, semester, tx);
  const position = await getNextCoursePosition(semesterId, tx);
  const [inserted] = await tx
    .insert(courses)
    .values({
      semesterId,
      name: course.name,
      code: course.code ?? null,
      sks: course.sks,
      description: course.description ?? null,
      prerequisites: course.prerequisites ?? null,
      materialUrl: course.materialUrl ?? null,
      position,
    })
    .returning();

  return mapCourseRow(inserted);
}

function buildCourseConditions(params: { search?: string; sks?: number; program?: string; semester?: string }): SQL[] {
  const conditions: SQL[] = [];
  if (params.program) conditions.push(eq(semesters.programId, params.program));
  if (params.semester) conditions.push(eq(semesters.semester, String(params.semester)));
  if (params.sks) conditions.push(eq(courses.sks, params.sks));
  if (params.search) {
    const search = `%${params.search}%`;
    const match = or(ilike(courses.name, search), ilike(courses.code, search));
    if (match) conditions.push(match);
  }
  return conditions;
}

export async function searchCourses(params: {
  search?: string;
  sks?: number;
  program?: string;
  semester?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = buildCourseConditions(params);

  let query = db
    .select({ c: courses, s: semesters, p: programs })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .innerJoin(programs, eq(semesters.programId, programs.id))
    .$dynamic();

  if (conditions.length) query = query.where(and(...conditions));
  query = query.orderBy(asc(programs.name), asc(semesters.position), asc(courses.position));

  if (params.limit !== undefined) {
    query = query.limit(params.limit).offset(params.offset ?? 0);
  }

  const rows = await query;
  return rows.map((row) => ({
    programId: row.s.programId,
    programName: row.p.name,
    semester: isNaN(Number(row.s.semester)) ? row.s.semester : Number(row.s.semester),
    course: mapCourseRow(row.c),
  }));
}

export async function countCourses(
  params: { search?: string; sks?: number; program?: string; semester?: string } = {},
): Promise<number> {
  const conditions = buildCourseConditions(params);

  let query = db
    .select({ total: sql<number>`count(*)` })
    .from(courses)
    .innerJoin(semesters, eq(courses.semesterId, semesters.id))
    .innerJoin(programs, eq(semesters.programId, programs.id))
    .$dynamic();

  if (conditions.length) query = query.where(and(...conditions));
  const rows = await query;
  return Number(rows[0]?.total ?? 0);
}

export async function createCourse(programId: string, semester: string | number, course: Course): Promise<Course> {
  const created = await db.transaction((tx) => insertCourseWithExecutor(programId, semester, course, tx));
  invalidateCurriculumCache();
  return created;
}

export async function updateCourse(courseId: number, updates: CourseUpdate): Promise<Course | null> {
  const updated = await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({ c: courses, s: semesters })
      .from(courses)
      .innerJoin(semesters, eq(courses.semesterId, semesters.id))
      .where(eq(courses.id, courseId));
    const row = existingRows[0];
    if (!row) return null;

    const existing = row.c;
    const currentSemester = row.s;
    const targetProgramId = updates.programId ?? currentSemester.programId;
    const targetSemester = updates.semester !== undefined ? String(updates.semester).trim() : currentSemester.semester;
    const movedSemester = targetProgramId !== currentSemester.programId || targetSemester !== currentSemester.semester;

    const set: Record<string, unknown> = {};
    if (movedSemester) {
      if (targetProgramId !== currentSemester.programId) {
        const progRows = await tx.select({ id: programs.id }).from(programs).where(eq(programs.id, targetProgramId));
        if (!progRows.length) throw new Error('Program not found');
      }
      const targetSemesterId = await getOrCreateSemesterId(targetProgramId, targetSemester, tx);
      set.semesterId = targetSemesterId;
      set.position = await getNextCoursePosition(targetSemesterId, tx);
    }
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.code !== undefined) set.code = updates.code ?? null;
    if (updates.sks !== undefined) set.sks = updates.sks;
    if (updates.description !== undefined) set.description = updates.description ?? null;
    if (updates.prerequisites !== undefined) set.prerequisites = updates.prerequisites ?? null;
    if (updates.materialUrl !== undefined) set.materialUrl = updates.materialUrl ?? null;

    if (Object.keys(set).length > 0) {
      await tx.update(courses).set(set).where(eq(courses.id, courseId));
    }
    if (movedSemester) {
      await pruneSemesterIfEmpty(existing.semesterId, tx);
    }

    const updatedRows = await tx.select().from(courses).where(eq(courses.id, courseId));
    const nextRow = updatedRows[0];
    return nextRow ? mapCourseRow(nextRow) : null;
  });

  if (updated) invalidateCurriculumCache();
  return updated;
}

export async function deleteCourse(courseId: number): Promise<Course | null> {
  const deleted = await db.transaction(async (tx) => {
    const rows = await tx.select().from(courses).where(eq(courses.id, courseId));
    const course = rows[0];
    if (!course) return null;
    await tx.delete(courses).where(eq(courses.id, courseId));
    await pruneSemesterIfEmpty(course.semesterId, tx);
    return mapCourseRow(course);
  });

  if (deleted) invalidateCurriculumCache();
  return deleted;
}
