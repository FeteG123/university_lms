# Snowflake IDs and Rate Limiter

#r11 #from_scratch

Directory: `services/api/app/from_scratch/` (required dedicated folder for R11)

---

## Snowflake ID generator

**File:** `services/api/app/from_scratch/snowflake.py`  
**Factory:** `services/api/app/snowflake_gen.py` → `get_snowflake()` singleton per process

### 64-bit layout

```
| 41 bits timestamp ms | 10 bits worker_id | 12 bits sequence |
```

- **Epoch:** 2024-01-01 UTC (`_EPOCH_MS`) — keeps IDs smaller than Unix epoch
- **worker_id:** 0–1023 from env `WORKER_ID` (compose: api-1=1, api-2=2)
- **sequence:** up to 4096 IDs per ms per worker; spins if exhausted same ms
- **Thread-safe:** `threading.Lock`
- **Clock backward:** raises `RuntimeError` (safety)

### Integration

On **first** submission create in `assignments.py`:

```python
sub.public_id = get_snowflake().next_id()
```

Resubmit updates same row — **does not** mint new public_id.

Lookup: `GET /api/submissions/by-public/{public_id}`

### Viva talking points

- Time-ordered IDs → good for B-tree indexes vs random UUID
- Per-replica worker id avoids collision across processes
- Not distributed coordination service — fits 2 known replicas

---

## Token-bucket rate limiter

**File:** `services/api/app/from_scratch/rate_limiter.py`  
**Registered:** `main.py` → `app.add_middleware(RateLimiterMiddleware)`

- Per **client IP** (from `request.client.host`)
- ~**100 requests per minute** default
- In-memory buckets (not Redis) — each replica has own counters
- Returns **429 Too Many Requests**

Explain trade-off: simple DDOS mitigation without Redis dependency.

---

## Rubric

- **R11** — from-scratch component, integrated, limitations in PDF
- Tie to submissions feature in demo

See [[Assignments Submissions Grades]], [[Rubric R1-R13 Evidence]].
