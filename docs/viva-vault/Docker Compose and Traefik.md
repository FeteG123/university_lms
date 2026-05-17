# Docker Compose and Traefik

#deploy #r8 #r9

**Files:** `docker-compose.yml`, `docker-compose.prod.yml`, `infra/traefik/`  
**Guide:** `docs/DEPLOY_VM.md`  
**Live host:** `university-lms.mooo.com` (see `infra/traefik/dynamic/routes.yml`)

---

## Services (main stack)

| Service | Purpose |
|---------|---------|
| traefik | Gateway :80, :443, dashboard :8080 |
| postgres | Primary DB, volume `postgres_data` |
| redis | AOF persistence `redis_data` |
| migrate | One-shot `alembic upgrade head` |
| api-1, api-2 | FastAPI + static SPA, volume `submission_data` |
| worker | Celery |

**Profile `observability`:** otel-collector, tempo, loki, promtail, prometheus, grafana

---

## One command

```bash
docker compose up -d --build
# production VM:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Traefik routing

**Static:** `infra/traefik/traefik.yml` — entrypoints `web` (:80), `websecure` (:443)

**Dynamic:** `infra/traefik/dynamic/routes.yml`

- Router `lms-http` matches Host(localhost, VM IP, `university-lms.mooo.com`)
- Service `lms-api` load balances to `http://api-1:8000` and `http://api-2:8000`

**R9:** Only Traefik ports should be public on firewall (not 5432, 6379).

---

## TLS (R8) — current gap

- `websecure` entrypoint exists but **no TLS router/certs** configured yet
- Production URL is **HTTP** — add Let's Encrypt before final demo if R8 weighted heavily
- See `DEPLOY_VM.md` section 10

---

## Health checks

Compose healthchecks on postgres, redis, api replicas — Traefik `depends_on: service_healthy`.

- Liveness: `GET /health/live`
- Readiness: `GET /health/ready` (DB + Redis)

---

## Environment (viva)

| Variable | Why |
|----------|-----|
| `DATABASE_URL` | SQLAlchemy |
| `REDIS_URL` / Celery URLs | 3 Redis logical DBs |
| `JWT_SECRET` | Must be strong on VM |
| `WORKER_ID` | Snowflake per replica |
| `SUBMISSION_STORAGE_PATH` | Shared volume for uploads |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | R12 traces |

---

## Rubric

- **R8** — gateway + 2 replicas + TLS (partial)
- **R9** — compose, volumes, health, single entry
- **R2** — draw compose dependency graph in PDF

See [[Observability R12]], [[Rubric R1-R13 Evidence]].
