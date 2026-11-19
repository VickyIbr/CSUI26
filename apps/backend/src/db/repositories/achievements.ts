import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type {
  Achievement,
  AchievementCreate,
  AchievementUpdate,
  LatestAchievement,
  PublicAchievementsResponse,
  YearGroup,
  YearlyAchievement,
} from '../../schemas/index.js';
import { createTtlCache } from '../../lib/cache.js';
import { db } from '../client.js';
import { achievements } from '../schema.js';

const achievementsCache = createTtlCache<PublicAchievementsResponse>(60_000);

export function invalidateAchievementsCache(): void {
  achievementsCache.clear();
}

function mapAchievementRow(row: typeof achievements.$inferSelect): Achievement {
  return {
    id: row.id,
    title: row.title,
    award: row.award ?? '',
    year: row.year,
    isFeatured: row.isFeatured,
    image: row.image ?? { url: '' },
    teamName: row.teamName ?? '',
    members: row.members ?? [],
    description: row.description ?? '',
    showOverlay: row.showOverlay,
    position: row.position,
  };
}

function buildAchievementConditions(params: { search?: string; year?: number; isFeatured?: boolean }): SQL[] {
  const conditions: SQL[] = [];
  if (params.year !== undefined) conditions.push(eq(achievements.year, params.year));
  if (params.isFeatured !== undefined) conditions.push(eq(achievements.isFeatured, params.isFeatured));
  if (params.search) {
    const q = `%${params.search}%`;
    const match = or(
      ilike(achievements.title, q),
      ilike(achievements.award, q),
      ilike(achievements.teamName, q),
    );
    if (match) conditions.push(match);
  }
  return conditions;
}

export async function countAchievements(
  filters: { search?: string; year?: number; isFeatured?: boolean } = {},
): Promise<number> {
  const conditions = buildAchievementConditions(filters);
  let query = db.select({ total: sql<number>`count(*)` }).from(achievements).$dynamic();
  if (conditions.length) query = query.where(and(...conditions));
  const rows = await query;
  return Number(rows[0]?.total ?? 0);
}

export async function getAllAchievements(
  opts: { search?: string; year?: number; isFeatured?: boolean; limit?: number; offset?: number } = {},
): Promise<Achievement[]> {
  const conditions = buildAchievementConditions(opts);
  let query = db.select().from(achievements).$dynamic();
  if (conditions.length) query = query.where(and(...conditions));
  query = query.orderBy(desc(achievements.year), asc(achievements.position), asc(achievements.title));
  if (opts.limit !== undefined) {
    query = query.limit(opts.limit).offset(opts.offset ?? 0);
  }
  const rows = await query;
  return rows.map(mapAchievementRow);
}

export async function getGroupedAchievements(): Promise<PublicAchievementsResponse> {
  const cached = achievementsCache.get('achievements:grouped');
  if (cached) return cached;

  const rows = await db
    .select()
    .from(achievements)
    .orderBy(asc(achievements.position), desc(achievements.year), asc(achievements.id));

  const latestAchievements: LatestAchievement[] = [];
  const byYear = new Map<number, YearlyAchievement[]>();

  for (const row of rows) {
    if (row.isFeatured) {
      latestAchievements.push({
        id: row.id,
        title: row.title,
        award: row.award ?? '',
        image: row.image?.url ?? '',
        ...(row.image?.config ? { imageConfig: row.image.config } : {}),
        teamName: row.teamName ?? '',
        members: row.members ?? [],
        description: row.description ?? '',
        showOverlay: row.showOverlay,
      });
      continue;
    }

    const list = byYear.get(row.year) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      ...(row.award ? { award: row.award } : {}),
      year: row.year,
    });
    byYear.set(row.year, list);
  }

  const yearlyAchievementsByYear: YearGroup[] = Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, items]) => ({ year, items }));

  const result: PublicAchievementsResponse = {
    latestAchievements,
    yearlyAchievementsByYear,
  };
  achievementsCache.set('achievements:grouped', result);
  return result;
}

export async function getAchievementById(id: string): Promise<Achievement | null> {
  const rows = await db.select().from(achievements).where(eq(achievements.id, id));
  return rows[0] ? mapAchievementRow(rows[0]) : null;
}

export async function createAchievement(input: AchievementCreate): Promise<Achievement> {
  await db.insert(achievements).values({
    id: input.id,
    title: input.title,
    award: input.award || null,
    year: input.year,
    isFeatured: input.isFeatured,
    image: input.image?.url ? input.image : null,
    teamName: input.teamName || null,
    members: input.members ?? [],
    description: input.description || null,
    showOverlay: input.showOverlay ?? true,
    position: input.position ?? 0,
  });
  invalidateAchievementsCache();
  return (await getAchievementById(input.id))!;
}

export async function updateAchievement(id: string, updates: AchievementUpdate): Promise<Achievement | null> {
  const existing = await getAchievementById(id);
  if (!existing) return null;

  const set: Record<string, unknown> = {};
  if (updates.title !== undefined) set.title = updates.title;
  if (updates.award !== undefined) set.award = updates.award || null;
  if (updates.year !== undefined) set.year = updates.year;
  if (updates.isFeatured !== undefined) set.isFeatured = updates.isFeatured;
  if (updates.image !== undefined) set.image = updates.image?.url ? updates.image : null;
  if (updates.teamName !== undefined) set.teamName = updates.teamName || null;
  if (updates.members !== undefined) set.members = updates.members;
  if (updates.description !== undefined) set.description = updates.description || null;
  if (updates.showOverlay !== undefined) set.showOverlay = updates.showOverlay;
  if (updates.position !== undefined) set.position = updates.position;

  if (Object.keys(set).length > 0) {
    set.updatedAt = sql`extract(epoch from now())::int`;
    await db.update(achievements).set(set).where(eq(achievements.id, id));
    invalidateAchievementsCache();
  }
  return getAchievementById(id);
}

export async function deleteAchievement(id: string): Promise<boolean> {
  const result = await db.delete(achievements).where(eq(achievements.id, id)).returning({ id: achievements.id });
  if (result.length > 0) {
    invalidateAchievementsCache();
    return true;
  }
  return false;
}
