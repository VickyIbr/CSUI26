import { createApp } from './app.js';

const app = createApp();

const start = async () => {
  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Backend running on http://localhost:${port}`);
};

start().catch(err => {
  console.error(err);
  process.exit(1);
});