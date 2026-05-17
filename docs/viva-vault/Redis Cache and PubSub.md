# Redis Cache and PubSub

#redis #r5

**Client:** `services/api/app/redis_client.py` — `REDIS_URL` (default DB **0**)

Redis is used for **three different jobs** (also Celery uses DB 1 and 2):

| Redis DB | Env var | Purpose |
|----------|---------|---------|
| 0 | `REDIS_URL` | Course list cache + lecture pub/sub |
| 1 | `CELERY_BROKER_URL` | Celery task queue |
| 2 | `CELERY_RESULT_BACKEND` | Celery task results |

---

## 1. Course list cache (R5/R6)

**File:** `services/api/app/services/courses_cache.py`

| Constant | Value |
|----------|-------|
| Key | `lms:v1:courses:list` |
| TTL | 120 seconds |
| Format | JSON array of course dicts |

**Read:** `get_cached_course_list()` in `list_courses` when admin, no search, no catalog.

**Write:** after DB query on MISS.

**Invalidate:** `invalidate_course_list_cache()` on enrollment changes and course mutations.

**Prove in demo:**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/courses -i
# First: X-Cache: MISS
# Second within 120s: X-Cache: HIT
curl ".../api/courses?skip_cache=true"  # forces DB
```

---

## 2. Lecture pub/sub (R5/R7 multi-replica)

**File:** `services/api/app/services/lecture_chat.py`

| Function | Role |
|----------|------|
| `channel_key(course_id)` | Returns `lms:lecture:{course_id}` |
| `persist_message` | INSERT into Postgres `chat_messages` |
| `encode_wire_payload` | JSON for wire |

**File:** `services/api/app/ws/lecture.py`

1. Client connects with JWT
2. Subscribe to Redis channel (async redis)
3. On message: persist to Postgres → `PUBLISH` JSON to channel
4. Background task: `listen` on subscription → `websocket.send_text` to all local clients

Why Redis? So **api-1** and **api-2** both receive publishes and fan-out to their connected browsers.

**History** is always from **Postgres** (`GET /api/courses/{id}/lecture/messages`), not Redis.

---

## What we do NOT store in Redis

- User sessions (JWT is stateless)
- Chat backlog (Postgres)
- Submission files (disk volume)

---

## Report paragraph (R5)

> We use PostgreSQL as the system of record for relational data and chat history. Redis provides a low-latency course-list cache for admin dashboards and a pub/sub channel so WebSocket messages reach clients connected to either API replica. Celery uses separate Redis databases as message broker and result backend, which is a standard pattern for task queues.

---

## Rubric

- **R5** — polyglot + justification
- **R6** — cache benchmark
- **R8/R9** — Redis container in compose with volume `redis_data`

See [[WebSocket Lecture Chat]], [[Celery Plagiarism Pipeline]], [[Rubric R1-R13 Evidence]].
