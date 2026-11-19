import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const isServerless = process.env.VERCEL === '1';
const parsedMax = Number(process.env.DB_POOL_MAX);
const max = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : (isServerless ? 1 : 10);
const prepare = process.env.DB_PREPARE !== undefined
  ? process.env.DB_PREPARE !== 'false'
  : !isServerless;
const parsedIdle = Number(process.env.DB_IDLE_TIMEOUT);
const idleTimeout = Number.isFinite(parsedIdle) && parsedIdle > 0 ? parsedIdle : (isServerless ? 20 : 30);

export const sql = postgres(DATABASE_URL, {
  max,
  prepare,
  idle_timeout: idleTimeout,
});
export const db = drizzle(sql, { schema });
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
export default db;
