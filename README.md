# Zenith Backend

A portable Docker Compose development stack for the Zenith backend. It gives the backend one private PostgreSQL database and one S3-compatible SeaweedFS object store, with a small Fastify placeholder intended to be replaced by the real one.

The stack is intended for local development. Every dependency is reachable from the backend by Docker service name, so the future application does not need public database or object-storage endpoints.

## Included services

| Service | Purpose | Internal address |
| --- | --- | --- |
| `backend` | Temporary HTTP placeholder with `GET /healthz` | `backend:8080` |
| `postgres` | Application database and SeaweedFS filer metadata | `postgres:5432` |
| `seaweedfs` | S3-compatible object storage and Filer UI | `seaweedfs:8333`, `seaweedfs:8888` |

Replace only the `backend` service when the real application is available. It must listen on port `8080` and continue to provide `GET /healthz`, or update the Compose healthcheck at the same time.

## Quick start

**Prerequisites:**
* Docker Engine with Docker Compose v2
* Bash
* Python 3
* OpenSSL

Run the following command to setup dev mode Zenith backend:

```bash
cd /path/to/zenith-backend

./scripts/init-secrets.sh
./scripts/validate-config.sh

# Dev Mode, omit "-f compose.dev.yml" for production
docker compose -f compose.yml -f compose.dev.yml up -d

./scripts/verify.sh
```

The first start creates the `zenith` and `assets` S3 buckets automatically before the backend starts.

### Dev Mode (`compose.dev.yml`)

`compose.yml` is the production-safe base: every service stays on the private Docker network, it publishes no host ports, and SeaweedFS has no browser-development CORS origins.

`compose.dev.yml` makes services available to tools and browsers on your local machine:

| Local address | Usage | Container |
| --- | --- | --- |
| http://127.0.0.1:8080 | **Fastify backend placeholder, replace with the real one** | `backend` |
| `127.0.0.1:5432` | PostgreSQL clients such as `psql`, a database GUI, etc. | `postgres` |
| http://127.0.0.1:8333 | SeaweedFS S3 API | `seaweedfs` |
| http://127.0.0.1:8888 | [SeaweedFS Filer UI](https://github.com/seaweedfs/seaweedfs-web) | `seaweedfs` |

If a default port is already busy, choose different local ports without editing Compose files:

```bash
ZENITH_BACKEND_PORT=18080 \
ZENITH_POSTGRES_PORT=15432 \
ZENITH_S3_PORT=18333 \
ZENITH_FILER_PORT=18888 \
docker compose -f compose.yml -f compose.dev.yml up -d
```

The local addresses use the chosen ports, while services inside Docker still use `backend:8080`, `postgres:5432`, and `seaweedfs:8333`. The verification script checks the services from inside the Compose network; test the loopback addresses separately on the development machine if that machine uses custom Docker networking.

Dev Mode also loads the generated local `.env` file into PostgreSQL (`postgres`) and the backend (`backend`) so they receive the passwords and S3 credentials created by `./scripts/init-secrets.sh`.

Dev Mode permits a local frontend website hosted from `http://localhost:5173` or `http://127.0.0.1:5173` to use SeaweedFS directly. This matters only when the local frontend uploads or downloads with backend-issued presigned S3 URLs; otherwise, you can ignore it.

Stop the stack with:

```bash
docker compose -f compose.yml -f compose.dev.yml down
```

## Backend integration

Compose injects the backend's internal connection settings:

```text
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=zenith_backend
DATABASE_USER=zenith_backend
DATABASE_PASSWORD=<generated secret>

S3_ENDPOINT=http://seaweedfs:8333
S3_REGION=us-east-1
S3_BUCKET=zenith
S3_ACCESS_KEY_ID=<generated key>
S3_SECRET_ACCESS_KEY=<generated secret>
```

Use `http://seaweedfs:8333` from code inside the backend container. Code running directly on the development machine should instead use `http://127.0.0.1:8333`.

## Private dependency checks

The placeholder backend is a plain JavaScript Fastify service with a direct PostgreSQL pool and an S3 client. It exposes private routes that exercise both dependencies without publishing anything to the host network.

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Liveness probe |
| `GET /selfcheck` | Connects to PostgreSQL and does a full S3 put/get/delete round trip |
| `GET /notes`, `POST /notes` | Read and insert rows in `probe_notes` |
| `GET /objects/*`, `PUT /objects/*`, `DELETE /objects/*` | Read, write, and delete objects in the `zenith` bucket |

Run the dependency check from inside the Compose network:

```bash
docker compose -f compose.yml -f compose.dev.yml exec backend \
    wget -qO- http://127.0.0.1:8080/selfcheck
```

`/selfcheck` returns 200 only when both PostgreSQL and SeaweedFS succeed, and 503 with a per-dependency error otherwise. Its S3 probe writes a temporary object, reads it back, then deletes it, so repeated calls do not accumulate storage.

The `backend` service itself still publishes no host port. Reach it from the host only through `compose.dev.yml`, or from another container on the private network.

The generated S3 identities are separated by responsibility:

- `zenith-backend-storage-admin` for administrative tools only
- `zenith-backend` for the application's `zenith` bucket
- `zenith-assets-writer` for writing only to the `assets` bucket

Keep permanent S3 credentials in the backend. Browser and mobile clients should receive short-lived presigned URLs only after the backend authorizes the requested operation.

## Local state

`./scripts/init-secrets.sh` creates a new local `.env`, `secrets/`, `postgres/`, and `seaweed/` directory tree. SeaweedFS copies its generated configuration into its container at startup so the storage process can read it without loosening host secret-file permissions. These files are ignored by Git and must stay local to the environment that created them.

Do not copy `.env` or `secrets/` between machines. Each development environment must generate its own credentials and data. If data needs to survive a machine change, back up PostgreSQL and all SeaweedFS directories together:

```text
postgres/
seaweed/master/
seaweed/volume/
seaweed/filer/
secrets/  # encrypted backup only
```

A PostgreSQL-only backup cannot restore SeaweedFS object bytes, and volume data without filer metadata cannot restore the object namespace.
