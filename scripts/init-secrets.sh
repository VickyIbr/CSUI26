#!/usr/bin/env bash
# Creates local credentials and generated SeaweedFS configuration once.
# It refuses to overwrite existing secrets or a PostgreSQL data directory.

set -eu -o pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
secrets_dir="$project_dir/secrets"
env_file="$project_dir/.env"
s3_file="$secrets_dir/s3.json"
filer_file="$secrets_dir/filer.toml"
pg_data_dir="$project_dir/postgres"

fail() {
    printf 'error: %s\n' "$*" >&2
    exit 1
}

random_base64() {
    openssl rand -base64 "$1" | tr -d '\n'
}

random_hex() {
    openssl rand -hex "$1"
}

if [[ -e "$env_file" || -e "$s3_file" || -e "$filer_file" ]]; then
    fail "refusing to overwrite an existing .env or generated secret configuration"
fi

if [[ -d "$pg_data_dir" ]] && find "$pg_data_dir" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
    fail "refusing to initialize because $pg_data_dir already contains PostgreSQL data"
fi

command -v openssl >/dev/null 2>&1 || fail "openssl is required"

umask 077
mkdir -p "$secrets_dir" "$pg_data_dir" \
    "$project_dir/seaweed/master" \
    "$project_dir/seaweed/volume" \
    "$project_dir/seaweed/filer"


postgres_password=$(random_base64 48)
filer_password=$(random_base64 48)
backend_password=$(random_hex 24)
jwt_secret=$(random_hex 32)
s3_admin_access_key="zadmin$(random_hex 12)"
s3_admin_secret_key=$(random_base64 48)
s3_assets_access_key="zassets$(random_hex 12)"
s3_assets_secret_key=$(random_base64 48)
s3_backend_access_key="zbackend$(random_hex 12)"
s3_backend_secret_key=$(random_base64 48)

{
    printf '%s\n' 'POSTGRES_SUPERUSER=postgres'
    printf 'POSTGRES_SUPERUSER_PASSWORD="%s"\n' "$postgres_password"
    printf '%s\n' 'POSTGRES_DEFAULT_DATABASE=postgres'
    printf '%s\n' ''
    printf '%s\n' 'SEAWEED_FILERS_DATABASE=seaweedfs_filer'
    printf '%s\n' 'SEAWEED_FILERS_USER=seaweedfs_filer'
    printf 'SEAWEED_FILERS_PASSWORD="%s"\n' "$filer_password"
    printf '%s\n' ''
    printf '%s\n' 'ZENITH_BACKEND_DATABASE=zenith_backend'
    printf '%s\n' 'ZENITH_BACKEND_USER=zenith_backend'
    printf 'ZENITH_BACKEND_PASSWORD=%s\n' "$backend_password"
    printf '%s\n' ''
    printf 'SEAWEED_S3_ADMIN_ACCESS_KEY=%s\n' "$s3_admin_access_key"
    printf 'SEAWEED_S3_ADMIN_SECRET_KEY="%s"\n' "$s3_admin_secret_key"
    printf 'SEAWEED_S3_ASSETS_ACCESS_KEY=%s\n' "$s3_assets_access_key"
    printf 'SEAWEED_S3_ASSETS_SECRET_KEY="%s"\n' "$s3_assets_secret_key"
    printf 'ZENITH_BACKEND_S3_ACCESS_KEY=%s\n' "$s3_backend_access_key"
    printf 'ZENITH_BACKEND_S3_SECRET_KEY="%s"\n' "$s3_backend_secret_key"
    printf '%s\n' ''
    printf 'JWT_SECRET=%s\n' "$jwt_secret"
    printf '%s\n' 'JWT_EXPIRES_IN=7d'
    printf '%s\n' 'SERVICE_URL=http://127.0.0.1'
    printf '%s\n' 'FRONTEND_URL=http://127.0.0.1/studio'
    printf '%s\n' 'ALLOWED_ORIGINS=http://127.0.0.1,http://localhost'
    printf '%s\n' 'ADMIN_NPM_LIST='
    printf '%s\n' 'S3_PUBLIC_URL=http://127.0.0.1:8333/zenith'
    printf '%s\n' 'VITE_BASE_PATH=/studio/'
    printf '%s\n' 'VITE_API_BASE_URL=/api/v1'
} >"$env_file"

cat >"$s3_file" <<EOF
{
  "identities": [
    {
      "name": "zenith-backend-storage-admin",
      "credentials": [
        {
          "accessKey": "$s3_admin_access_key",
          "secretKey": "$s3_admin_secret_key"
        }
      ],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    },
    {
      "name": "zenith-assets-writer",
      "credentials": [
        {
          "accessKey": "$s3_assets_access_key",
          "secretKey": "$s3_assets_secret_key"
        }
      ],
      "actions": ["Read:assets", "List:assets", "Tagging:assets", "Write:assets"]
    },
    {
      "name": "zenith-backend",
      "credentials": [
        {
          "accessKey": "$s3_backend_access_key",
          "secretKey": "$s3_backend_secret_key"
        }
      ],
      "actions": ["Read:zenith", "List:zenith", "Tagging:zenith", "Write:zenith"]
    }
  ]
}
EOF

cat >"$filer_file" <<EOF
[postgres]
enabled = true
hostname = "postgres"
port = 5432
username = "seaweedfs_filer"
password = "$filer_password"
database = "seaweedfs_filer"
schema = "public"
sslmode = "disable"
createTable = """
CREATE TABLE IF NOT EXISTS \"%s\" (
    \"dirhash\" BIGINT NOT NULL,
    \"name\" VARCHAR(65535) NOT NULL,
    \"directory\" TEXT NOT NULL,
    \"meta\" BYTEA,
    PRIMARY KEY (\"dirhash\", \"name\")
)
"""
EOF

chmod 0600 "$env_file" "$s3_file" "$filer_file"

printf '%s\n' "Created $env_file and $secrets_dir."
printf '%s\n' 'Store these credentials in your password manager before starting containers.'
printf '%s\n' "Next: $project_dir/scripts/validate-config.sh"
