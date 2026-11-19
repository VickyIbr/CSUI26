#!/usr/bin/env bash
# Run after `docker compose -f compose.yml -f compose.dev.yml up -d`.

set -eu -o pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
export ZENITH_ENV_FILE="$project_dir/.env"
compose=(docker compose --project-directory "$project_dir" --env-file "$project_dir/.env" -f "$project_dir/compose.yml" -f "$project_dir/compose.dev.yml")
postgres_port=${ZENITH_POSTGRES_PORT:-5432}
s3_port=${ZENITH_S3_PORT:-8333}
filer_port=${ZENITH_FILER_PORT:-8888}
backend_port=${ZENITH_BACKEND_PORT:-8080}

fail() {
    printf 'error: %s\n' "$*" >&2
    exit 1
}

require_running() {
    local service=$1
    local state

    state=$("${compose[@]}" ps --format json "$service" | python3 -c '
import json
import sys
items = json.load(sys.stdin)
if isinstance(items, dict):
    items = [items]
print(items[0].get("State", "") if items else "")
') || fail "could not inspect $service"

    [[ "$state" == "running" ]] || fail "$service is not running (state: ${state:-missing})"
}

for service in postgres seaweedfs backend frontend gateway; do
    require_running "$service"
done

postgres_superuser=$(sed -n 's/^POSTGRES_SUPERUSER=//p' "$project_dir/.env" | head -n 1)
postgres_password=$(sed -n 's/^POSTGRES_SUPERUSER_PASSWORD="\(.*\)"$/\1/p' "$project_dir/.env" | head -n 1)
[[ -n "$postgres_superuser" ]] || fail 'POSTGRES_SUPERUSER is missing from .env'
[[ -n "$postgres_password" ]] || fail 'POSTGRES_SUPERUSER_PASSWORD is missing from .env'

"${compose[@]}" exec -T -e PGPASSWORD="$postgres_password" postgres psql \
    --username "$postgres_superuser" \
    --dbname postgres \
    --tuples-only \
    --no-align \
    --command "SELECT count(*) FROM pg_database WHERE datname IN ('seaweedfs_filer', 'zenith_backend')" |
    grep -qx '2' || fail 'expected databases are missing'

"${compose[@]}" exec -T seaweedfs wget -q --spider http://127.0.0.1:8888/ ||
    fail 'SeaweedFS filer UI did not answer inside its container'

"${compose[@]}" exec -T seaweedfs /bin/sh -c 'wget -q --spider http://127.0.0.1:8333/ 2>/dev/null || test "$?" -eq 1' ||
    fail 'SeaweedFS S3 API did not answer inside its container'

"${compose[@]}" exec -T backend wget -q --spider http://127.0.0.1:8080/healthz ||
    fail 'backend did not answer inside its container'

"${compose[@]}" exec -T frontend wget -q --spider http://127.0.0.1:80/ ||
    fail 'frontend did not answer inside its container'

"${compose[@]}" exec -T gateway wget -q --spider http://127.0.0.1:80/healthz ||
    fail 'gateway did not answer /healthz inside its container'

printf '%s\n' 'Zenith stack checks passed.'
printf '%s\n' "Local host endpoints are published on ports: gateway=${ZENITH_GATEWAY_PORT:-80} backend=$backend_port frontend=${ZENITH_FRONTEND_PORT:-3000} postgres=$postgres_port s3=$s3_port filer=$filer_port"
