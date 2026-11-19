FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY apps/website/package.json apps/website/bun.lock ./
RUN bun install --frozen-lockfile

COPY apps/website/ ./
RUN bun run build

FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
