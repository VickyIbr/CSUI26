import { beforeEach, afterEach } from 'vitest';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://zenith:devpass@localhost:5433/zenith_test';
process.env.ADMIN_NPM_LIST = process.env.ADMIN_NPM_LIST || '2606888572';

beforeEach(() => {
  // Database cleanup is handled per test file when needed.
});

afterEach(() => {
  // No-op
});