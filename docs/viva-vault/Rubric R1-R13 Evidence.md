# Rubric R1–R13 Evidence

#rubric

Tracker in repo: `PROJECT_REQUIREMENTS_STATUS.md`

---

## R1 — Business scenario, use cases, requirements

| Status | Report only |
|--------|-------------|
| **Evidence in code** | Scenario implemented: courses, enroll, assignments, chat, plagiarism, grades |
| **You write** | ≥5 use cases, functional + non-functional (latency, security, scale) |
| **Link** | [[Architecture Overview]], `FUNCTIONAL_SPEC.md` use cases |

---

## R2 — ER, schema, architecture, compose graph

| Status | Report only (hand ER) |
|--------|----------------------|
| **Evidence** | [[Database Schema and Migrations]] — Alembic chain |
| **Forbidden** | ORM-only ER export as sole diagram |
| **Link** | `services/api/alembic/versions/`, `infra/` |

---

## R3 — DBMS + migrations + seed + one-command

| Status | **Met** |
|--------|---------|
| **Evidence** | PostgreSQL; `migrate` service; `scripts/seed.sql` |
| **Command** | `docker compose up -d` runs migrate then APIs |
| **Link** | [[Database Schema and Migrations]] |

---

## R4 — REST + OpenAPI on deploy

| Status | **Met** |
|--------|---------|
| **Evidence** | FastAPI; `/docs` on deployed host |
| **Link** | [[REST API Reference]], `routers/*.py` |

---

## R5 — Polyglot + rationale

| Status | **Met** |
|--------|---------|
| **Evidence** | Postgres + Redis (cache, pub/sub, Celery) |
| **Link** | [[Redis Cache and PubSub]], [[Database Schema and Migrations]] |
| **Report** | ~1 page why each store |

---

## R6 — Optimisation + numbers

| Status | **Partial** |
|--------|-------------|
| **Evidence** | Redis cache `lms:v1:courses:list`, indexes in migrations, `skip_cache` query param |
| **You measure** | Latency or TTFB: first `GET /api/courses` MISS vs HIT vs `skip_cache=true` |
| **Link** | `services/api/app/services/courses_cache.py`, `courses.py` list_courses |

Example curl (admin token):

```bash
curl -w "%{time_total}\n" -H "Authorization: Bearer $TOKEN" http://HOST/api/courses -o /dev/null -s
```

---

## R7 — Non-REST (WS)

| Status | **Met** |
|--------|---------|
| **Evidence** | WebSocket lecture chat |
| **Link** | [[WebSocket Lecture Chat]] |
| **Optional** | Webhook on plagiarism complete (not implemented) |

---

## R8 — Gateway + TLS + ≥2 replicas

| Status | **Partial** |
|--------|-------------|
| **Met** | Traefik; api-1 + api-2 load balanced |
| **Gap** | **TLS not on VM yet** — HTTP only at university-lms.mooo.com |
| **Link** | [[Docker Compose and Traefik]], `infra/traefik/dynamic/routes.yml` |

---

## R9 — docker-compose, one port, health, volumes

| Status | **Met** |
|--------|---------|
| **Evidence** | `docker-compose.yml`; `:80` public; healthchecks; named volumes |
| **Link** | [[Docker Compose and Traefik]] |

---

## R10 — Batch/stream + BPMN

| Status | **Partial** |
|--------|-------------|
| **Evidence** | Celery `lms.analyze_submission` |
| **Report** | BPMN diagram (hand) for submit → queue → worker → DB update |
| **Link** | [[Celery Plagiarism Pipeline]] |

---

## R11 — From-scratch component

| Status | **Met** |
|--------|---------|
| **Evidence** | `from_scratch/snowflake.py` + rate limiter; `public_id` on submissions |
| **Link** | [[Snowflake IDs and Rate Limiter]] |
| **Report** | Design, trade-offs, clock skew, worker ids |

---

## R12 — Traces + logs + metrics unified

| Status | **Partial** (code yes, PDF screenshots needed) |
|--------|-----------------------------------------------|
| **Evidence** | Observability profile + `telemetry.py` |
| **Link** | [[Observability R12]], `docs/R12_OBSERVABILITY.md` |

---

## R13 — README, API docs, CHANGELOG

| Status | **Partial** |
|--------|-------------|
| **Evidence** | `README.md`, Swagger, changelog section in README |
| **Todo** | Endpoint table in PDF; keep CHANGELOG on tag `v1.0` |

---

## Deliverables checklist

| Item | Status |
|------|--------|
| Public URL | http://university-lms.mooo.com |
| GitHub | LINKS.txt |
| PDF 10–15 pages | Team must produce |
| LINKS.txt zip | Team |
| Git tag v1.0 | Team |
| Commits all members | Team process |

---

## Grade drivers (honest)

**Strong:** R3, R4, R5, R7, R9, R11, feature completeness  
**Fix for A:** R8 TLS, R6 numbers, R12 screenshots, R10 BPMN, R1/R2 PDF, viva ownership

See [[Viva Q&A Cheat Sheet]], [[Demo Script]].
