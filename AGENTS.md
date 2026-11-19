# CSUI Zenith Service

Admin dashboard and curriculum/member REST API for Fakultas Ilmu Komputer UI (CSUI). Serves an unauthenticated public landing page and an SSO-authenticated admin/self-service dashboard.

## Stack

- **Monorepo:** pnpm Workspaces (`apps/*`, `packages/*`) + Turborepo + `@zenith/shared` (Zod v4 contracts, DTO types) + `@zenith/sso-ui` (CAS 2.0 client & UI org-code mapper)
- **Backend (`@zenith/backend`):** Fastify v5 + TypeScript + PostgreSQL 16 + Drizzle ORM (`postgres`) + Zod + Vitest
- **Frontend (`@zenith/frontend`):** React 19 + React Router (`react-router`) + Vite + Tailwind CSS v4 + shadcn/ui + Vitest + Oxlint
- **Auth:** SSO UI CAS 2.0 (`@zenith/sso-ui`) + JWT (`httpOnly` cookie `token` or `Authorization: Bearer`)
- **Deploy:** Dual-mode same-origin `/api/v1`: Vercel (Static SPA + `api/index.ts` serverless + managed Postgres) or VPS (`docker-compose` with Nginx + Fastify + PostgreSQL 16 + MinIO)

## Directory Map

```text
CSUI-ZenithService/
├── .github/workflows/        # CI pipeline (build, lint, test)
├── package.json              # Root workspace scripts & Turborepo CLI
├── pnpm-workspace.yaml       # Workspaces: apps/*, packages/*
├── tsconfig.base.json        # Shared TypeScript compiler options
├── turbo.json                # Pipeline caching (build, lint, test, dev)
├── vercel.json               # Vercel build config & same-origin /api/* rewrites
├── api/
│   └── index.ts              # Vercel serverless entrypoint wrapping @zenith/backend
├── packages/
│   ├── shared/               # @zenith/shared: Zod schemas, DTO types, API envelopes
│   └── sso-ui/               # @zenith/sso-ui: CAS 2.0 client, orgMapper & org_code_details.json
├── apps/
│   ├── backend/              # @zenith/backend: Fastify v5 + Drizzle ORM + PostgreSQL 16
│   │   ├── drizzle/          # SQL migrations
│   │   └── src/
│   │       ├── app.ts        # Fastify app factory, plugins & centralized error handler
│   │       ├── server.ts     # Server bootstrap
│   │       ├── config/       # Env & auth config
│   │       ├── lib/          # Native TTL cache & image header helpers
│   │       ├── db/
│   │       │   ├── client.ts     # Env-configurable postgres-js pool (VPS vs. Serverless)
│   │       │   ├── migrate.ts    # Programmatic Drizzle migration runner
│   │       │   ├── schema.ts     # PostgreSQL schema & relations
│   │       │   ├── repository.ts # Barrel re-exporting domain repositories
│   │       │   ├── repositories/ # programs.ts, courses.ts, members.ts, achievements.ts
│   │       │   └── seed.ts       # Initial DB & S3 media seeder
│   │       ├── middleware/   # JWT, whitelist, RBAC, PII serialization, auth TTL cache
│   │       ├── routes/       # auth.ts, programs.ts, courses.ts, members.ts, achievements.ts, upload.ts
│   │       ├── schemas/      # Re-exports @zenith/shared
│   │       ├── services/     # S3 storage service
│   │       └── __tests__/    # Vitest DB schema & API integration tests
│   └── frontend/             # @zenith/frontend: React 19 + Vite + Tailwind v4 + shadcn/ui
│       ├── DESIGN.md         # Visual & component rules
│       └── src/
│           ├── index.css     # Semantic CSS tokens, Inter & JetBrains Mono
│           ├── app/          # Router, providers, navigation, fallback pages
│           ├── components/   # layout/, patterns/, ui/ (shadcn/ui)
│           ├── features/     # auth/, programs/, courses/, members/, achievements/
│           ├── hooks/        # Shared React hooks
│           └── lib/          # API client & utils
├── data/                     # Seed JSON datasets (academic, members, achievements)
└── docs/                     # PRD & implementation plan
```

## Auth & Security Boundaries

- **Session-Aware Member Reads:** `GET /api/v1/members` and `GET /api/v1/members/:npm` use `optionalAuth()` (with 30s TTL lookup cache) + `serializeMemberForViewer()`. Unauthenticated or non-whitelisted callers receive public profile fields only (`email` and `role` stripped). Valid whitelisted sessions receive the full `Member` payload.
- **Self-Profile Edits:** `PUT /api/v1/members/me` requires `blockUnauthorized()` + `requireWhitelisted()` (live DB lookup), parses body with `MemberUpdateSchema.omit({ role: true })` (allows `email`, `programId`/`major`, and profile fields; locks `npm` and `role`), returns `409 Conflict` on duplicate `email`, and invalidates auth cache.
- **Admin Mutations:** Program, course, achievement, and member `POST`/`PUT`/`DELETE` routes plus `PUT /api/v1/members/:npm/role` require `blockUnauthorized()` + `adminOnly()`. Admin status comes from `members.role` in PostgreSQL or immutable `ADMIN_NPM_LIST`.
- **Cookie Security:** `token` cookie sets `httpOnly: true`, `sameSite: 'lax'`, and `secure: true` when `NODE_ENV=production`.
- **Frontend Route Guards (`apps/frontend/src/app/router.tsx`):** `/login`, `/auth/callback`, `/access-denied` are public; `/` redirects to `/my-profile` inside `ProtectedRoute`; `/programs`, `/courses`, `/members`, `/achievements` require `AdminRoute`.

## Database & Repository Conventions

- **Schema & Migrations:** Defined in `apps/backend/src/db/schema.ts`; never reintroduce SQLite. Production containers run `node apps/backend/dist/db/migrate.js` before startup.
- **Env-Aware Pooling (`apps/backend/src/db/client.ts`):** Defaults to `max: 1, prepare: false` when `VERCEL=1` and `max: 10, prepare: true` on VPS/local; overridable via `DB_POOL_MAX`, `DB_PREPARE`, and `DB_IDLE_TIMEOUT`.
- **No N+1 Queries & Read Cache:** `getAllPrograms()`, `getProgramById()`, and `getAllSemesters()` batch-fetch via `inArray` (`hydratePrograms` / `buildSemestersMap` in `apps/backend/src/db/repositories/programs.ts`) with a 60s TTL cache invalidated on program/course mutations.
- **Lightweight Health:** `GET /health` uses SQL `COUNT(*)` via `countPrograms()` and `countMembers()`.
- **Transactional Curriculum Lifecycle:** `createProgram()`, `createCourse()`, `updateCourse()` (relocating `programId`/`semester`), and `deleteCourse()` execute inside `db.transaction()` and auto-prune emptied `semesters`.

## Frontend UI Conventions

- Follow `apps/frontend/DESIGN.md` and semantic tokens in `apps/frontend/src/index.css` (`Inter` UI font, `JetBrains Mono` tabular numerals, light-first `:root` + `.dark`).
- Use `shadcn/ui` primitives (`Select`, `Field`, `Card`, `Table`, `Dialog`) and `components/patterns/*` instead of raw `<select>` elements or literal hex colors.
- Keep UI copy in concise English; avoid empty `catch` blocks, `window.confirm`, and em-dashes in UI copy.

## Commands

### Monorepo (Turborepo)
- `pnpm dev` — Run workspace dev servers (`turbo run dev`)
- `pnpm turbo run build` — Build `@zenith/shared`, `@zenith/sso-ui`, `@zenith/backend`, and `@zenith/frontend`
- `pnpm turbo run lint` — Typecheck/lint across all workspace packages
- `pnpm turbo run test` — Run unit and integration Vitest suites across all packages

### SSO UI (`@zenith/sso-ui`)
- `pnpm --filter @zenith/sso-ui run build` — Build CAS 2.0 client & bundled org mapper
- `pnpm --filter @zenith/sso-ui run lint` — Typecheck `@zenith/sso-ui`
- `pnpm --filter @zenith/sso-ui test` — Run `@zenith/sso-ui` unit tests

### Backend (`@zenith/backend`)
- `pnpm --filter @zenith/backend run dev` — Start Fastify dev server (`http://localhost:3001`)
- `pnpm --filter @zenith/backend run build` — Typecheck & compile (`tsc`)
- `pnpm --filter @zenith/backend test` — Run Vitest suite (requires PostgreSQL on `localhost:5433` or `TEST_DATABASE_URL`)
- `pnpm --filter @zenith/backend run db:migrate` — Apply Drizzle migrations
- `pnpm --filter @zenith/backend run seed` — Seed programs, courses, members, and achievements

### Frontend (`@zenith/frontend`)
- `pnpm --filter @zenith/frontend run dev` — Start Vite dev server (`http://localhost:5173`, proxies `/api/*`)
- `pnpm --filter @zenith/frontend run lint` — Run `oxlint`
- `pnpm --filter @zenith/frontend test` — Run Vitest unit tests
- `pnpm --filter @zenith/frontend run build` — Typecheck (`tsc -b`) and build production bundle
