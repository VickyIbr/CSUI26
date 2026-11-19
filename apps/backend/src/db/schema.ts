import { sql } from 'drizzle-orm';
import { pgTable, text, serial, integer, boolean, jsonb, unique, index, check } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { ImageConfig } from '@zenith/shared';

export const programs = pgTable('programs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  careers: jsonb('careers').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  courseMapUrl: text('course_map_url').notNull(),
  driveUrl: text('drive_url').notNull(),
  createdAt: integer('created_at').notNull().default(sql`extract(epoch from now())::int`),
  updatedAt: integer('updated_at').notNull().default(sql`extract(epoch from now())::int`),
}, (table) => ({
  nameIdx: index('idx_programs_name').on(table.name),
}));

export const semesters = pgTable('semesters', {
  id: serial('id').primaryKey(),
  programId: text('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  semester: text('semester').notNull(),
  position: integer('position').notNull().default(0),
}, (table) => ({
  programSemesterUnique: unique('semesters_program_semester_unique').on(table.programId, table.semester),
  programIdx: index('idx_semesters_program').on(table.programId),
}));

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  semesterId: integer('semester_id').notNull().references(() => semesters.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code'),
  sks: integer('sks').notNull(),
  description: text('description'),
  prerequisites: jsonb('prerequisites').$type<string[] | null>(),
  materialUrl: text('material_url'),
  position: integer('position').notNull().default(0),
}, (table) => ({
  semesterIdx: index('idx_courses_semester').on(table.semesterId),
  codeIdx: index('idx_courses_code').on(table.code),
  sksCheck: check('courses_sks_check', sql`${table.sks} > 0 AND ${table.sks} <= 6`),
}));

export const members = pgTable('members', {
  npm: text('npm').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  namaPanggilan: text('nama_panggilan').notNull(),
  programId: text('program_id').notNull().references(() => programs.id, { onDelete: 'restrict' }),
  instagram: text('instagram'),
  line: text('line'),
  github: text('github'),
  linkedin: text('linkedin'),
  deskripsi: text('deskripsi'),
  niche: text('niche'),
  quotes: text('quotes'),
  foto: jsonb('foto').$type<{ url: string; config?: ImageConfig }>().notNull(),
  role: text('role').notNull().default('user'),
  createdAt: integer('created_at').notNull().default(sql`extract(epoch from now())::int`),
  updatedAt: integer('updated_at').notNull().default(sql`extract(epoch from now())::int`),
}, (table) => ({
  programIdx: index('idx_members_program').on(table.programId),
  nameIdx: index('idx_members_name').on(table.name),
  roleIdx: index('idx_members_role').on(table.role),
}));

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  award: text('award'),
  year: integer('year').notNull(),
  isFeatured: boolean('is_featured').notNull().default(false),
  image: jsonb('image').$type<{ url: string; config?: ImageConfig } | null>(),
  teamName: text('team_name'),
  members: jsonb('members').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  description: text('description'),
  showOverlay: boolean('show_overlay').notNull().default(true),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at').notNull().default(sql`extract(epoch from now())::int`),
  updatedAt: integer('updated_at').notNull().default(sql`extract(epoch from now())::int`),
}, (table) => ({
  yearIdx: index('idx_achievements_year').on(table.year),
  featuredIdx: index('idx_achievements_featured').on(table.isFeatured),
}));

export const programsRelations = relations(programs, ({ many }) => ({
  semesters: many(semesters),
  members: many(members),
}));

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  program: one(programs, {
    fields: [semesters.programId],
    references: [programs.id],
  }),
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one }) => ({
  semester: one(semesters, {
    fields: [courses.semesterId],
    references: [semesters.id],
  }),
}));

export const membersRelations = relations(members, ({ one }) => ({
  program: one(programs, {
    fields: [members.programId],
    references: [programs.id],
  }),
}));