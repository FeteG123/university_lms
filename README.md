# LMS Lite (scaffold)

**Rubric & deliverables tracker:** [`PROJECT_REQUIREMENTS_STATUS.md`](PROJECT_REQUIREMENTS_STATUS.md) (R1–R13, submission checklist, gaps).

FastAPI backend with **PostgreSQL**, **Redis**, **Celery**, and a **React (Vite) web UI** served from the same app behind **Traefik** (two API replicas).

## Prerequisites

- Docker Engine + Docker Compose v2
- (Optional) Node.js 20+ if you want to run the frontend dev server locally

## One-command bring-up

From the repository root:

```bash
docker compose up -d --build
```

### Deploy on a public VM (rubric URL)

Use **Docker Compose + Traefik** on a Linux VM; see **[`docs/DEPLOY_VM.md`](docs/DEPLOY_VM.md)** (firewall, `.env`, Traefik `Host(...)`, optional `docker-compose.prod.yml` without dev bind mounts).

### Production-style API image (no hot-reload mount)

On a server, prefer:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- **Web app (browser):** `http://localhost/` — sign in first (`/login`). Demo password **`demo1234`** for `student@example.edu`, `instructor@example.edu`, `admin@example.edu`
- **REST API base path:** `/api` (e.g. `GET http://localhost/api/courses`)
- **OpenAPI / Swagger:** `http://localhost/docs`
- **Traefik dashboard (dev):** `http://localhost:8080/dashboard/`
- **WebSocket lecture room:** `ws://localhost/ws/lectures/{course_id}?user_id=1&display_name=Ada` (also used from the web UI)

### Frontend development (optional)

The UI is **built inside Docker** and served from the API container. You do **not** need Node on your PC to run the app.

**IDE red squiggles in `services/web`?** Install Node once so TypeScript finds `react`:

```powershell
cd services\web
npm install
```

**Refresh on `/courses/1` shows `{"detail":"Not Found"}`?** Rebuild after pulling — the API now serves `index.html` for all non-API routes:

```powershell
docker compose up -d --build
```

**Local Vite dev** (proxies `/api` to the stack):

```powershell
cd services\web
npm install
npm run dev
```

Then open `http://localhost:5173/`.

### Login problems (401)

If demo accounts fail with **401**, reset passwords in Postgres:

```powershell
Get-Content scripts\reset_demo_passwords.sql | docker compose exec -T postgres psql -U lms -d lms
```

Or re-run the full seed (see below). Password is always **`demo1234`**.

### Seed demo data

PowerShell:

```powershell
Get-Content scripts\seed.sql | docker compose exec -T postgres psql -U lms -d lms
```

Then open `http://localhost/`, or call `GET http://localhost/api/courses` (expect `X-Cache: MISS` then `HIT` on refresh).

### Docker build: `short read … unexpected EOF`

That usually means a **layer download from Docker Hub was cut off** (Wi‑Fi, VPN, or a bad cache entry). Try:

```powershell
docker compose build --no-cache
```

If it still fails, **Docker Desktop → Troubleshoot → Clean / Purge data** (or `docker builder prune -af` then `docker system prune -f`), switch network or turn VPN off, and build again. This repo’s Dockerfile builds the SPA **without** a separate `node:*` image (Node comes from Debian packages on `python:3.12-slim`) so you only pull one app base image.

### Reset everything (destructive)

```powershell
docker compose down -v
docker compose up -d --build
```

## Environment variables

Copy `.env.example` to `.env`. Main variables:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_*` | Postgres role, password, database |
| `DATABASE_URL` | SQLAlchemy URL (`postgresql+psycopg://...`) |
| `REDIS_URL` | Redis DB **0** — HTTP cache + lecture pub/sub |
| `CELERY_BROKER_URL` | Redis DB **1** — Celery broker |
| `CELERY_RESULT_BACKEND` | Redis DB **2** — Celery results |
| `WORKER_ID` | **0–1023**, unique per API replica for Snowflake IDs (compose sets `1` / `2`) |

## Course rubric mapping (implementation pointers)

| ID | What this repo demonstrates |
|----|-------------------------------|
| R3 | Alembic migrations under `services/api/alembic/versions/`, `migrate` service, `scripts/seed.sql` |
| R4 | REST + OpenAPI at `/docs` |
| R5 | Redis for course-list cache + lecture pub/sub (not a second relational DB) |
| R6 | `GET /api/courses` with `X-Cache: HIT`/`MISS`; `skip_cache=true` for before/after in your report |
| R7 | WebSocket `/ws/lectures/{course_id}` |
| R8–R9 | Traefik + two `api-*` services in `docker-compose.yml` |
| R10 | Celery task `lms.analyze_submission` — document workflows with **BPMN in the PDF** |
| R11 | `app/from_scratch/snowflake.py` + `app/snowflake_gen.py` used when creating submissions |
| R12 | **Grafana LGTM** (profile `observability`): Tempo + Loki + Prometheus + OTel Collector; see [`docs/R12_OBSERVABILITY.md`](docs/R12_OBSERVABILITY.md) |
| R13 | This file + Swagger |

## Enrollment

- **Students:** Home shows **My courses** (enrolled only). Use **Catalog** to browse all courses → open a course → **Enroll** → assignments, materials, lecture chat, and grades unlock.
- **Lecturers / admins:** Can enroll a specific user with `POST /api/courses/{course_id}/enrollments` and body `{"user_id": <id>}` (Swagger: try it out).

## Observability (R12)

Optional **Grafana** stack (traces in **Tempo**, logs in **Loki**, metrics in **Prometheus**, OTLP via **OpenTelemetry Collector**):

1. Add to `.env`: `OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4317` and `OTEL_SERVICE_NAME=lms-api` (see `.env.example`).
2. **Grafana only starts if you enable the Compose profile** (otherwise nothing listens on port 3000 → connection refused):

   ```bash
   docker compose --profile observability up -d --build
   ```

   Or set `COMPOSE_PROFILES=observability` in `.env` so a normal `docker compose up -d` also starts Grafana and friends.

3. Open **http://localhost:3000** (Grafana; default `admin`/`admin` unless overridden).

Full steps, ports, and **PDF screenshot checklist**: [`docs/R12_OBSERVABILITY.md`](docs/R12_OBSERVABILITY.md).

## From-scratch component (R11)

Source: `services/api/app/from_scratch/snowflake.py` — integrated via `POST /assignments/{id}/submissions` (`public_id` field).

## Contributor notes

- **Schema changes:** edit SQLAlchemy models, add an Alembic revision, review autogenerate output, commit.
- **New REST modules:** add `app/routers/*.py` and `include_router` in `app/main.py`.
- **Gateway:** Traefik static + dynamic files under `infra/traefik/`.

## Changelog

### 0.6.0

- Course **materials** (professor/admin): upload files, external links, text notes (`course_materials` table).
- **Search** on courses (`?q=`) and admin users list (`?q=`, `?role=`).
- Student **My courses** vs **Catalog**; admin enroll/unenroll and professor reassignment on course page.
- Assignment **due dates** in professor UI (enforced on submit).

### 0.5.0

- R12: OpenTelemetry traces (FastAPI + SQLAlchemy + Celery when OTLP env set), Prometheus `/metrics`, Docker Compose profile **`observability`** (Grafana, Tempo, Loki, Prometheus, OTel Collector, Promtail). Guide: `docs/R12_OBSERVABILITY.md`.

### 0.4.0

- JWT auth (student / lecturer / admin), protected API, login UI.
- Grades table, instructor grading, student grade view, CSV export per course.
- WebSocket lecture uses JWT token (not raw `user_id`).

### 0.3.0

- Web UI (`services/web`): Vite + React; served from `/` in the API image; REST moved under `/api`.

### 0.2.0

- LMS tables: courses, enrollments, assignments, submissions.
- Redis-backed `GET /api/courses` cache; Celery plagiarism heuristic task; WebSocket lecture room with Redis pub/sub; React SPA at `/`.
- Snowflake-style `public_id` on submissions.

### 0.1.0

- Initial Traefik + Postgres + Redis + dual FastAPI replicas.
