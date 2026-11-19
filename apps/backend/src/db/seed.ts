import '../config/env.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ImageConfig } from '@zenith/shared';
import { db } from './client.js';
import { programs, semesters, courses, members, achievements } from './schema.js';
import { parseImageHeader } from '../lib/image.js';
import { buildPublicUrl, headObject, putObject } from '../services/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = existsSync(join(__dirname, '../../../../data'))
  ? join(__dirname, '../../../../data')
  : join(__dirname, '../../../data');
const ACADEMIC_FILE = join(DATA_DIR, 'academic.json');
const MEMBERS_FILE = join(DATA_DIR, 'members.json');
const ACHIEVEMENTS_FILE = join(DATA_DIR, 'achievements.json');

interface Course { name: string; code?: string; sks: number; description?: string; prerequisites?: string[]; materialUrl?: string; }
interface Semester { semester: number | string; courses: Course[]; }
interface Program { id: string; name: string; slug: string; description: string; careers: string[]; courseMapUrl: string; driveUrl: string; semesters: Semester[]; }
interface MemberFoto { url: string; config?: ImageConfig; }
interface Member { npm: string; email: string; name: string; nama_panggilan: string; major: string; instagram: string; line: string; github: string; linkedin: string; deskripsi: string; niche: string; quotes: string; foto: MemberFoto; }
interface SeedAchievement {
  id: string;
  title: string;
  award?: string;
  year: number;
  isFeatured: boolean;
  image?: MemberFoto;
  teamName?: string;
  members?: string[];
  description?: string;
  showOverlay?: boolean;
  position?: number;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function migrateImageToS3(sourceUrl: string, targetKeyPrefix: string): Promise<string> {
  if (!sourceUrl || !process.env.S3_ENDPOINT) return sourceUrl;
  if (!sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://')) return sourceUrl;

  try {
    for (const ext of ['webp', 'jpg', 'png'] as const) {
      const key = `${targetKeyPrefix}.${ext}`;
      if (await headObject(key)) {
        return buildPublicUrl(key);
      }
    }

    const candidates = sourceUrl.includes('lh3.googleusercontent.com/d/') && !sourceUrl.includes('=')
      ? [`${sourceUrl}=s1600`, `${sourceUrl}=s1024`, sourceUrl]
      : [sourceUrl];

    let buf: Buffer | null = null;
    for (const url of candidates) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        redirect: 'follow',
        headers: { Accept: 'image/webp,image/*' },
      });
      if (!res.ok) continue;
      const candidateBuf = Buffer.from(await res.arrayBuffer());
      buf = candidateBuf;
      if (candidateBuf.byteLength <= 2 * 1024 * 1024) break;
    }

    if (!buf) throw new Error('Failed to fetch image');
    const meta = parseImageHeader(buf, 20 * 1024 * 1024);
    const stored = await putObject(`${targetKeyPrefix}.${meta.ext}`, buf, meta.mime);
    return stored.url;
  } catch (err) {
    console.warn(`[seed] Image migration skipped for ${targetKeyPrefix}: ${(err as Error).message}`);
    return sourceUrl;
  }
}

async function seedPrograms() {
  if (!existsSync(ACADEMIC_FILE)) {
    console.log('academic.json not found, skipping programs seed');
    return;
  }

  const programsData: Program[] = JSON.parse(readFileSync(ACADEMIC_FILE, 'utf-8'));

  await db.delete(members);
  await db.delete(courses);
  await db.delete(semesters);
  await db.delete(programs);

  for (const program of programsData) {
    await db.insert(programs).values({
      id: program.id,
      name: program.name,
      slug: program.slug,
      description: program.description,
      careers: program.careers,
      courseMapUrl: program.courseMapUrl,
      driveUrl: program.driveUrl,
    });

    for (let semIdx = 0; semIdx < program.semesters.length; semIdx++) {
      const sem = program.semesters[semIdx];
      const inserted = await db.insert(semesters).values({
        programId: program.id,
        semester: String(sem.semester),
        position: semIdx,
      }).returning({ id: semesters.id });

      const semesterId = inserted[0].id;
      for (let courseIdx = 0; courseIdx < sem.courses.length; courseIdx++) {
        const course = sem.courses[courseIdx];
        await db.insert(courses).values({
          semesterId,
          name: course.name,
          code: course.code || null,
          sks: course.sks,
          description: course.description || null,
          prerequisites: course.prerequisites || null,
          materialUrl: course.materialUrl || null,
          position: courseIdx,
        });
      }
    }
  }

  console.log(`Seeded ${programsData.length} programs with courses`);
}

async function seedMembers() {
  if (!existsSync(MEMBERS_FILE)) {
    console.log('members.json not found, skipping members seed');
    return;
  }

  const membersData: Member[] = JSON.parse(readFileSync(MEMBERS_FILE, 'utf-8'));
  const programRows = await db.select({ id: programs.id, name: programs.name }).from(programs);
  const programByKey = new Map<string, string>();
  for (const p of programRows) {
    programByKey.set(p.name, p.id);
    programByKey.set(p.id, p.id);
  }

  await db.delete(members);

  const valid: Array<{ member: Member; programId: string }> = [];
  for (const member of membersData) {
    const programId = programByKey.get(member.major);
    if (!programId) {
      console.log(`Skipping member ${member.npm} (${member.name}) - unknown program ${member.major}`);
      continue;
    }
    valid.push({ member, programId });
  }

  const rows = await mapWithConcurrency(valid, 5, async ({ member, programId }) => {
    const rawUrl = member.foto?.url?.trim() || '';
    const migratedUrl = rawUrl ? await migrateImageToS3(rawUrl, `members/${member.npm}`) : '';
    const fotoConfig = member.foto?.config ?? { x: 50, y: 50, zoom: 1, aspect: '1:1' };
    return {
      npm: member.npm,
      email: member.email,
      name: member.name,
      namaPanggilan: member.nama_panggilan,
      programId,
      instagram: member.instagram || null,
      line: member.line || null,
      github: member.github || null,
      linkedin: member.linkedin || null,
      deskripsi: member.deskripsi || null,
      niche: member.niche || null,
      quotes: member.quotes || null,
      foto: { config: fotoConfig, url: migratedUrl },
      role: 'user',
    };
  });

  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(members).values(rows.slice(i, i + 100));
  }

  console.log(`Seeded ${rows.length} members`);
}

export async function seedAchievements() {
  if (!existsSync(ACHIEVEMENTS_FILE)) {
    console.log('achievements.json not found, skipping achievements seed');
    return;
  }

  const items: SeedAchievement[] = JSON.parse(readFileSync(ACHIEVEMENTS_FILE, 'utf-8'));
  await db.delete(achievements);

  const rows = await mapWithConcurrency(items, 5, async (item, idx) => {
    const imageUrl = item.image?.url
      ? await migrateImageToS3(item.image.url, `achievements/${item.id}`)
      : '';
    return {
      id: item.id,
      title: item.title,
      award: item.award || null,
      year: item.year,
      isFeatured: item.isFeatured,
      image: imageUrl ? { ...item.image, url: imageUrl } : null,
      teamName: item.teamName || null,
      members: item.members ?? [],
      description: item.description || null,
      showOverlay: item.showOverlay ?? true,
      position: item.position ?? idx,
    };
  });

  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(achievements).values(rows.slice(i, i + 100));
  }

  console.log(`Seeded ${rows.length} achievements`);
}

async function main() {
  console.log('Starting database seed...');
  await seedPrograms();
  await seedMembers();
  await seedAchievements();
  console.log('Seed completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
