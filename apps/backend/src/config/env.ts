import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load .env from root or backend directory
const envPaths = [
  join(__dirname, '../../../../.env'), // root .env (from apps/backend/src/config/)
  join(__dirname, '../../.env'),       // apps/backend/.env
  join(process.cwd(), '.env'),         // cwd .env
  join(process.cwd(), '../.env'),      // parent .env
  join(process.cwd(), '../../.env'),   // root .env (when cwd is apps/backend/)
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      // Only set if not already in process.env (allow override)
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
    break; // Use first found .env
  }
}

export {};