import '../config/env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder });
    console.log('Database migrations applied');
  } finally {
    await sql.end();
  }
}

runMigrations().catch((err) => {
  console.error('Database migration failed:', err);
  process.exit(1);
});
