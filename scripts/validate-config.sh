#!/usr/bin/env bash
# Validate the deployment files without starting or changing containers.

set -eu -o pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

fail() {
    printf 'error: %s\n' "$*" >&2
    exit 1
}

for script in \
    "$project_dir/scripts/init-secrets.sh" \
    "$project_dir/scripts/validate-config.sh" \
    "$project_dir/scripts/verify.sh" \
    "$project_dir/initdb/10-create-roles.sh"; do
    bash -n "$script"
done

if [[ -f "$project_dir/.env" ]]; then
    required_files=(
        "$project_dir/.env"
        "$project_dir/secrets/s3.json"
        "$project_dir/secrets/filer.toml"
    )

    for file in "${required_files[@]}"; do
        [[ -f "$file" ]] || fail "missing $file; run ./scripts/init-secrets.sh first"
    done

    python3 -m json.tool "$project_dir/secrets/s3.json" >/dev/null
fi

if [[ -f "$project_dir/.env" ]]; then
    env_file=(--env-file "$project_dir/.env")
    export ZENITH_ENV_FILE="$project_dir/.env"
else
    tmp_env=$(mktemp)
    trap 'rm -f "$tmp_env"' EXIT
    cp "$project_dir/.env.example" "$tmp_env"
    env_file=(--env-file "$tmp_env")
    export ZENITH_ENV_FILE="$tmp_env"
fi

docker compose \
    --project-directory "$project_dir" \
    "${env_file[@]}" \
    -f "$project_dir/compose.yml" \
    config --quiet

docker compose \
    --project-directory "$project_dir" \
    "${env_file[@]}" \
    -f "$project_dir/compose.yml" \
    -f "$project_dir/compose.dev.yml" \
    config --quiet

printf '%s\n' 'Base and development Compose configurations are syntactically valid.'
