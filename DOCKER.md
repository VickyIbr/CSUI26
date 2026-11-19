# Docker Deployment Guide

## Prerequisites

- Docker Engine 24+
- Docker Compose v2.20+
- 2 GB RAM, 10 GB disk

## Quick Start

```bash
git clone <repo>
cd CSUI-ZenithService
cp .env.example .env
# Fill required variables in .env (POSTGRES_PASSWORD, JWT_SECRET, SERVICE_URL, FRONTEND_URL, ALLOWED_ORIGINS, ADMIN_NPM_LIST)

docker compose up -d                          # production
docker compose -f docker-compose.dev.yml up   # development
```

## Required Production Environment Variables

- `POSTGRES_PASSWORD`
- `JWT_SECRET` (generate with `openssl rand -hex 32`)
- `SERVICE_URL`
- `FRONTEND_URL`
- `ALLOWED_ORIGINS`
- `ADMIN_NPM_LIST`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` (defaults target the bundled MinIO service in `docker-compose.yml`)

## Manual Monorepo Build

```bash
pnpm install --frozen-lockfile
pnpm turbo run build
```

## Architecture Notes

- Production containers run `apps/backend` on port `3001` (auto-applying Drizzle migrations via `node apps/backend/dist/db/migrate.js`) and `apps/frontend` Nginx on port `80`.
- Workspace libraries `@zenith/shared` (`packages/shared`) and `@zenith/sso-ui` (`packages/sso-ui`) are built before `apps/backend` and `apps/frontend`.
- Persistent Docker volumes store PostgreSQL 16 data (`postgres-data`), MinIO media objects (`minio-data`), and backend logs (`backend-logs`).
- CORS is restricted to `ALLOWED_ORIGINS`, and API rate limiting defaults to 100 requests/min/IP.
