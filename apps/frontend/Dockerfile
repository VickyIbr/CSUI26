# Frontend Dockerfile
FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/sso-ui/package.json ./packages/sso-ui/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install frontend and shared workspace dependencies
RUN pnpm install --frozen-lockfile --filter @zenith/frontend...

# Copy shared and frontend sources
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

# Build shared contract package and frontend
ARG VITE_BASE_PATH=/studio/
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm --filter @zenith/shared run build && pnpm --filter @zenith/frontend run build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy build output
COPY --from=base /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
