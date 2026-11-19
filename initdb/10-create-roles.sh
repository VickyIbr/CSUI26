#!/usr/bin/env bash
set -euo pipefail

export PGPASSWORD="$POSTGRES_PASSWORD"

psql --set=ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set="filer_database=$SEAWEED_FILERS_DATABASE" \
    --set="filer_user=$SEAWEED_FILERS_USER" \
    --set="filer_password=$SEAWEED_FILERS_PASSWORD" \
    --set="backend_database=$ZENITH_BACKEND_DATABASE" \
    --set="backend_user=$ZENITH_BACKEND_USER" \
    --set="backend_password=$ZENITH_BACKEND_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'filer_user', :'filer_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'filer_user')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'filer_database', :'filer_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'filer_database')
\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'backend_user', :'backend_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'backend_user')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'backend_database', :'backend_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'backend_database')
\gexec
SQL
