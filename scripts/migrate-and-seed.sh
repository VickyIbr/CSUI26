#!/usr/bin/env bash
# Run Drizzle migrations and seed PostgreSQL + SeaweedFS S3 inside the backend container.

set -eu -o pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
compose_files=(-f "$project_dir/compose.yml")

if [[ -f "$project_dir/compose.dev.yml" ]]; then
    compose_files+=(-f "$project_dir/compose.dev.yml")
fi

docker compose \
    --project-directory "$project_dir" \
    --env-file "$project_dir/.env" \
    "${compose_files[@]}" \
    exec -T backend sh -c "node apps/backend/dist/db/migrate.js && node apps/backend/dist/db/seed.js"
