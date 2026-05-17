# LMS Lite — Project specification vs implementation

**Course:** Database Application and Design (Spring 2026, Inha)  
**Scenario:** University LMS-lite (courses, assignments, live lecture chat, plagiarism-style batch).  
**Last reviewed:** 2026-05-16 (PostgreSQL `chat_rooms`/`chat_messages`, submission file attachments; see migration `20260516_0004`).

**Functional spec:** see [`FUNCTIONAL_SPEC.md`](FUNCTIONAL_SPEC.md).

This file tracks **submission deliverables**, **R1–R13**, **report-only items**, and **gaps**. Keep it accurate as the project evolves.

---

## Team submission deliverables (eClass)

| # | Deliverable | Status | Notes |
|---|-------------|--------|--------|
| 1 | **Public deployed URL** | Not in repo | **How:** [`docs/DEPLOY_VM.md`](docs/DEPLOY_VM.md) — VM + Docker + Traefik `Host(...)` + `docker compose ... prod` + seed. |
| 2 | **GitHub URL** (public or invite instructor) | Team process | Ensure `.gitignore` excludes `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `*.log`, etc. |
| 3 | **PDF report** (10–15 pages, prescribed sections) | Not in repo | Must include hand-drawn **ER**, architecture, **BPMN for every pipeline workflow**, optimisation **numbers**, observability **screenshots**, team table, etc. |

**Zip submission:** `report.pdf` + `LINKS.txt` (deployed URL, GitHub URL, team roster) before deadline.

**Git:** tag final code **`v1.0`**, commits from all members (process marks).

---

## R1–R13 checklist

| ID | Requirement | Implementation status | Evidence / where | Still to do |
|----|-------------|----------------------|------------------|-------------|
| **R1** | Business scenario, ≥5 use cases, functional + non-functional requirements | **Report only** | Not stored as code | Write **Business Requirements** in PDF (actors, flows, scale, latency, availability, security). |
| **R2** | ER diagram (hand-designed), relational schema, system architecture, repo layout, **docker-compose dependency graph** | **Report only** | Alembic + models in repo; **ER must not be ORM-only export** | Draw ER by hand; diagrams for architecture, structure, Compose deps; align narrative with real migrations. |
| **R3** | Relational DBMS + migrations + seed + **one-command DB bring-up** | **Met** (minor naming) | PostgreSQL; `services/api/alembic/versions/`; `scripts/seed.sql`; `migrate` service in `docker compose` | Spec mentions `migrations/` — you use **Alembic** (acceptable). Optional: document as “migrations via Alembic”. |
| **R4** | REST + production framework + **live OpenAPI** on deployed URL | **Met** | FastAPI; `/docs`, `/openapi.json`; REST under **`/api`** | In report: **table of every endpoint** (verb, URL, schemas, error codes). |
| **R5** | **Polyglot** persistence (non-relational) + **working feature** + report rationale | **Met** | **Redis**: course list cache, lecture **pub/sub** (real-time fan-out), Celery broker/results; **Postgres**: chat history (`chat_rooms`, `chat_messages`), relational core | Report: **~1 page** why Redis fits for pub/sub/cache vs Postgres for durable chat and grades. |
| **R6** | Cache / indexes / optimisation + **quantitative before/after** | **Partial** | Redis cache `GET /api/courses` (`X-Cache` HIT/MISS); DB indexes in migrations | Run **measured** latency or query count (with `skip_cache=true` vs cold cache); add **Optimisation** section with a table of numbers. Optional: more indexes/materialised views if justified. |
| **R7** | Non-REST: WS, webhook, gRPC, or GraphQL — **meaningful** use | **Partial** | **WebSocket** `/ws/lectures/{course_id}` + Redis pub/sub (multi-replica) | Report: **paragraph** why WS fits. Optional second style (e.g. **webhook** on plagiarism complete) if you want extra depth. |
| **R8** | API gateway + **TLS in production** + **LB ≥2 replicas** | **Partial** | Traefik `infra/traefik/`; `api-1` / `api-2`; port **80** | **TLS:** add `websecure`, certificates (e.g. Let’s Encrypt), router `Host` for **real domain**; diagram **client → Traefik → replicas** in report. |
| **R9** | Single `docker-compose.yml`, `docker compose up -d`, **one public port via gateway**, health checks, **named volumes** | **Met** | `docker-compose.yml`; Traefik `:80`; healthchecks; `postgres_data`, `redis_data`, `submission_data` | Confirm production only exposes gateway (no accidental direct API ports). |
| **R10** | **Batch or stream** pipeline + **BPMN for every workflow** | **Partial** | **Celery** task `lms.analyze_submission` (Redis broker) | Report: **BPMN** for enqueue → analyse → persist (and any other workflows). Optional: cron, RabbitMQ/Kafka if you expand story. |
| **R11** | **From-scratch** component (DDIA/SDI style), **integrated**, code in **dedicated directory** | **Met** | `services/api/app/from_scratch/snowflake.py` + `snowflake_gen.py`; `public_id` on submissions | Report: design, trade-offs, integration, limitations. |
| **R12** | **Traces + logs + metrics** in **one** observability backend | **Partial → Met (code)** | Docker profile **`observability`**: Grafana + Tempo + Loki + Prometheus + OTel Collector; FastAPI OTel + `/metrics`; Promtail → Loki. See **`docs/R12_OBSERVABILITY.md`**. | **You:** run profile + `.env` OTLP vars; **PDF:** screenshots + correlation narrative per `docs/R12_OBSERVABILITY.md` checklist. |
| **R13** | README (one-command run, env table, contributor guide), **per-endpoint API docs**, CHANGELOG | **Partial** | `README.md`; Swagger; changelog section in README | Tighten README; ensure Swagger documents **all** `/api` routes; keep CHANGELOG updated per release. |

---

## LMS-lite scenario fit (optional stretch)

| Scenario idea | In codebase? |
|---------------|----------------|
| Courses, assignments, submissions | Yes |
| Course materials (professor upload) | Yes — `course_materials` table, file/link/note |
| Course & user search | Yes — `GET /courses?q=`, `GET /users?q=` |
| Live-lecture chat | Yes (Postgres history + WS + Redis pub/sub) |
| Plagiarism-scan batch | Yes (heuristic Celery task) |
| **Grade export** | **Yes** | `GET /api/courses/{id}/grades/export` (CSV); grades UI |
| **Admin user management** | **Yes** | `GET/POST/PATCH/DELETE /api/users` (admin); `/admin/users` UI |

---

## MVP Tier 1 checklist ([`FUNCTIONAL_SPEC.md`](FUNCTIONAL_SPEC.md))

| Feature | Status |
|---------|--------|
| Login + JWT + roles | **Done** — `POST /api/auth/login`, seed users, `/login` UI |
| Courses CRUD (scoped by role) | **Done** |
| Enroll self (student) | **Done** |
| Assignments + text/file submit | **Done** — multipart upload; metadata in Postgres, blobs on `submission_data` volume |
| Plagiarism batch (Celery) | **Done** |
| Live lecture chat (JWT WS) | **Done** |
| Grades + CSV export | **Done** |
| Instructor grade on assignment page | **Done** |
| Admin: list / create / deactivate / reactivate users | **Done** |
| Course materials (files, links, notes) | **Done** |
| Admin: enroll / unenroll / reassign professor | **Done** |
| Search courses & users | **Done** |
| Content modules (versioned PDF/PPT) / notifications | **Not started** (Tier 3) |

**Demo logins** (password `demo1234`): `student@example.edu`, `instructor@example.edu`, `admin@example.edu`

**After pull:** `docker compose up -d --build` then re-run seed (migration `20260515_0003` adds auth columns).

---

## “Forbidden” rules — quick compliance

| Rule | Risk | Mitigation |
|------|------|------------|
| No single-DB-as-polyglot | OK | Postgres + Redis in use |
| ER not ORM-only | Report | Hand-draw ER; align Alembic to it |
| No AI backend you cannot explain | Viva | Team owns and can explain code |
| BPMN not omitted for pipelines | Report | BPMN for Celery plagiarism workflow(s) |
| Endpoint docs not omitted | R13 / R4 | OpenAPI + report table |

---

## Suggested priority order (implementation)

1. **R12** observability stack (Grafana profile) — see **`docs/R12_OBSERVABILITY.md`**; PDF screenshots.  
2. **R8** TLS + real hostname on Traefik for production VM.  
3. **R6** capture before/after numbers and write up.  
4. **R10** BPMN in report; tighten pipeline narrative.  
5. **Report (R1, R2, all PDF sections)** and **deploy + LINKS.txt**.  
6. Optional: **webhooks**, stricter **auth**, more dashboards.

---

## File map (where rubric items live)

| Area | Paths |
|------|--------|
| Compose / gateway | `docker-compose.yml`, `infra/traefik/` |
| Migrations / seed | `services/api/alembic/versions/`, `scripts/seed.sql` |
| API + OpenAPI + static SPA | `services/api/app/main.py`, `services/api/app/routers/`, `/docs`, `/` static |
| Redis cache | `services/api/app/services/courses_cache.py` |
| WS lecture | `services/api/app/ws/lecture.py` |
| Celery | `services/api/app/celery_worker.py`, `worker` service |
| Snowflake (R11) | `services/api/app/from_scratch/`, `snowflake_gen.py` |
| Users (admin) | `services/api/app/routers/users.py`, `services/web/src/pages/AdminUsersPage.tsx` |
| Observability (R12) | `infra/otel/`, `infra/tempo/`, `infra/loki/`, `infra/promtail/`, `infra/prometheus/`, `infra/grafana/`, `services/api/app/telemetry.py`, `docs/R12_OBSERVABILITY.md` |
| VM deploy | [`docs/DEPLOY_VM.md`](docs/DEPLOY_VM.md), [`docker-compose.prod.yml`](docker-compose.prod.yml) |

---

*Update this document whenever you close a rubric gap or change architecture.*
