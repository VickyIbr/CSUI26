import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgres://zenith:devpass@localhost:5433/zenith_schema_test';
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

describe('Database Schema', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DB_URL, { max: 1 });
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`CREATE SCHEMA public`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('should create programs table', async () => {
    const result = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'programs'
    `;
    expect(result.length).toBe(1);
  });

  it('should insert a program', async () => {
    await sql`
      INSERT INTO programs (id, name, slug, description, careers, course_map_url, drive_url)
      VALUES ('cs', 'Computer Science', 'cs', 'CS Program', '[]'::jsonb, 'https://example.com', 'https://drive.com')
    `;
    const rows = await sql`SELECT * FROM programs WHERE id = 'cs'`;
    expect(rows[0].name).toBe('Computer Science');
  });

  it('should enforce foreign keys', async () => {
    let thrown = false;
    try {
      await sql`INSERT INTO semesters (program_id, semester, position) VALUES ('nonexistent', '1', 0)`;
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('should enforce unique constraints', async () => {
    await sql`
      INSERT INTO programs (id, name, slug, description, careers, course_map_url, drive_url)
      VALUES ('si', 'System Info', 'si', 'SI Program', '[]'::jsonb, 'https://example.com', 'https://drive.com')
    `;
    let thrown = false;
    try {
      await sql`
        INSERT INTO programs (id, name, slug, description, careers, course_map_url, drive_url)
        VALUES ('si', 'Duplicate', 'si', 'Duplicate', '[]'::jsonb, 'https://example.com', 'https://drive.com')
      `;
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('should enforce CHECK constraint on sks', async () => {
    const programId = 'ai';
    await sql`
      INSERT INTO programs (id, name, slug, description, careers, course_map_url, drive_url)
      VALUES (${programId}, 'AI', 'ai', 'AI Program', '[]'::jsonb, 'https://example.com', 'https://drive.com')
    `;
    const semRows = await sql`
      INSERT INTO semesters (program_id, semester, position) VALUES (${programId}, '1', 0)
      RETURNING id
    `;
    const semId = semRows[0].id;

    await sql`INSERT INTO courses (semester_id, name, sks, position) VALUES (${semId}, 'Valid Course', 3, 0)`;

    let thrown = false;
    try {
      await sql`INSERT INTO courses (semester_id, name, sks, position) VALUES (${semId}, 'Invalid', 0, 1)`;
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);

    thrown = false;
    try {
      await sql`INSERT INTO courses (semester_id, name, sks, position) VALUES (${semId}, 'Invalid', 7, 2)`;
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});