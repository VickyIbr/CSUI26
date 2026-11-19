# Backend Dockerfile
FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sso-ui/package.json ./packages/sso-ui/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install backend and workspace library dependencies
RUN pnpm install --frozen-lockfile --filter @zenith/backend...

# Copy shared, sso-ui, and backend sources
COPY packages/shared ./packages/shared
COPY packages/sso-ui ./packages/sso-ui
COPY apps/backend ./apps/backend

# Build workspace libraries and backend
RUN pnpm --filter @zenith/shared run build && pnpm --filter @zenith/sso-ui run build && pnpm --filter @zenith/backend run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sso-ui/package.json ./packages/sso-ui/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile --filter @zenith/backend... && pnpm store prune

# Copy built files and migrations from base stage
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/sso-ui/dist ./packages/sso-ui/dist
COPY --from=base /app/apps/backend/dist ./apps/backend/dist
COPY --from=base /app/apps/backend/drizzle ./apps/backend/drizzle

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3001

# Run migrations then start server
CMD ["sh", "-c", "node apps/backend/dist/db/migrate.js && node apps/backend/dist/server.js"]
