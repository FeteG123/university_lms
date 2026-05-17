# Viva Q&A Cheat Sheet

#viva

Short answers — expand with file names from linked notes.

---

## Architecture

**Q: Describe the system in 30 seconds.**  
A: React SPA behind Traefik, two FastAPI replicas, PostgreSQL for data, Redis for cache and chat pub/sub, Celery worker for plagiarism after submit. JWT auth, role-based access.

**Q: Why two databases?**  
A: Postgres = ACID relational + chat history. Redis = fast cache + pub/sub + Celery queues. See [[Redis Cache and PubSub]].

**Q: How do replicas share WebSocket messages?**  
A: Publish to Redis channel `lms:lecture:{id}`; each API replica subscribes and pushes to its WS clients. History in Postgres.

---

## Auth

**Q: How is the user authenticated?**  
A: POST login → bcrypt check → JWT HS256. Bearer on REST; `?token=` on WebSocket. `deps.get_current_user`.

**Q: Roles?**  
A: student, lecturer, admin — checked per endpoint, not middleware alone.

---

## Data

**Q: One submission per student?**  
A: Unique (assignment_id, student_id). Resubmit updates row, new plagiarism scan, keeps same `public_id`.

**Q: Course full?**  
A: Count enrollments vs `max_enrollment` before insert; 409 if full.

**Q: What is public_id?**  
A: Snowflake 64-bit ID from `from_scratch/snowflake.py`; worker id from env per replica.

---

## Celery

**Q: What does the worker do?**  
A: Jaccard word similarity vs other submissions on same assignment; stores max score.

**Q: Why not synchronous?**  
A: Keep HTTP fast; long analysis off request thread.

---

## Cache

**Q: What is cached?**  
A: Admin course list JSON, key `lms:v1:courses:list`, TTL 120s. Invalidated on enroll/course change.

**Q: How prove it works?**  
A: Response header `X-Cache: HIT` or `MISS`.

---

## Deploy

**Q: Public URL?**  
A: Traefik routes Host `university-lms.mooo.com` to api-1/api-2.

**Q: HTTPS?**  
A: Planned via Traefik Let's Encrypt on `websecure`; currently HTTP — see [[Docker Compose and Traefik]].

**Q: Migrations on VM?**  
A: `migrate` container runs Alembic before APIs start.

---

## Observability

**Q: R12 stack?**  
A: Prometheus metrics, Tempo traces via OTLP, Loki logs via Promtail, all in Grafana.

---

## Tricky / honest

**Q: Rate limiter distributed?**  
A: No — per-process memory; each replica separate buckets.

**Q: Material download in new tab?**  
A: API needs JWT; plain link may 401 — known UI gap.

**Q: AI used?**  
A: Be honest per your course policy; team must explain code they own.

---

## Who explains what (team)

| Topic | Owner |
|-------|-------|
| Migrations / ER | Person 1 |
| Routers / WS | Person 2 |
| Redis / Celery | Person 3 |
| Docker / Grafana / TLS | Person 4 |

---

## If asked to open code

| Question | Open file |
|----------|-----------|
| Login | `routers/auth.py`, `auth/security.py` |
| Enroll + capacity | `routers/courses.py` enroll() |
| Submit | `routers/assignments.py` |
| Snowflake | `from_scratch/snowflake.py` |
| WS | `ws/lecture.py` |
| Cache | `services/courses_cache.py` |
| Worker | `celery_worker.py` |
| Traefik | `infra/traefik/dynamic/routes.yml` |
