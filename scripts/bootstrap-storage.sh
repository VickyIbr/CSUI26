#!/usr/bin/env bash
# Create the buckets required by this stack after SeaweedFS becomes healthy.
# Safe to run repeatedly: existing buckets are left unchanged.

set -eu -o pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
compose=(docker compose --project-directory "$project_dir" --env-file "$project_dir/.env" -f "$project_dir/compose.yml" -f "$project_dir/compose.dev.yml")

admin_access_key=$(sed -n 's/^SEAWEED_S3_ADMIN_ACCESS_KEY=//p' "$project_dir/.env" | head -n 1)
admin_secret_key=$(sed -n 's/^SEAWEED_S3_ADMIN_SECRET_KEY="\(.*\)"$/\1/p' "$project_dir/.env" | head -n 1)

[[ -n "$admin_access_key" && -n "$admin_secret_key" ]] || {
    printf '%s\n' 'error: SeaweedFS admin credentials are missing from .env' >&2
    exit 1
}

for bucket in zenith assets; do
    if "${compose[@]}" exec -T \
        -e AWS_ACCESS_KEY_ID="$admin_access_key" \
        -e AWS_SECRET_ACCESS_KEY="$admin_secret_key" \
        -e AWS_DEFAULT_REGION=us-east-1 \
        seaweedfs /usr/bin/weed shell -cluster=seaweedfs:9333 -filer=seaweedfs:8888 -options="s3.bucket.list" 2>/dev/null | grep -qx "$bucket"; then
        continue
    fi

    "${compose[@]}" exec -T \
        -e AWS_ACCESS_KEY_ID="$admin_access_key" \
        -e AWS_SECRET_ACCESS_KEY="$admin_secret_key" \
        -e AWS_DEFAULT_REGION=us-east-1 \
        seaweedfs /bin/sh -ec "echo 'bucket.create -name=$bucket' | /usr/bin/weed shell -cluster=seaweedfs:9333 -filer=seaweedfs:8888"
done

printf '%s\n' 'Required SeaweedFS buckets are ready.'
