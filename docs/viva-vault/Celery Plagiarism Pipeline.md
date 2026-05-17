# Celery Plagiarism Pipeline

#celery #r10

**Worker:** `services/api/app/celery_worker.py`  
**Trigger:** `services/api/app/routers/assignments.py` after submission save  
**Compose service:** `worker` — same image as API

---

## Flow (batch pipeline)

```mermaid
flowchart LR
  A[POST submission] --> B[API commits row status=pending]
  B --> C[analyze_submission_task.delay id]
  C --> D[Redis broker DB 1]
  D --> E[Celery worker]
  E --> F[Load submission + peers]
  F --> G[Jaccard similarity]
  G --> H[UPDATE plagiarism_score status]
```

---

## Task: `lms.analyze_submission`

1. Open SQLAlchemy session
2. Load submission by id; if missing return `"missing"`
3. Read text: `body_text` or extract from file via `file_storage.submission_text_content`
4. Build word set (lowercase tokens)
5. Load **other** submissions for same `assignment_id`
6. For each peer, compute **Jaccard** = |∩| / |∪| on word sets
7. `plagiarism_score` = max similarity (0.0–1.0)
8. `plagiarism_status` = `completed` or `failed` on error
9. `scanned_at` = UTC now

This is a **heuristic**, not external Turnitin API — honest in viva.

---

## Why Celery?

- Submission HTTP must return fast — analysis can take seconds
- **Decouples** web request from CPU work
- Fits **R10** "batch pipeline" requirement

---

## BPMN (for PDF — draw by hand)

Suggested swimlanes: **Student/API**, **Redis queue**, **Worker**, **PostgreSQL**

1. Student submits → API validates enrollment
2. API writes submission `pending`
3. API sends task message to broker
4. Worker consumes task
5. Worker reads peer submissions from DB
6. Worker computes score
7. Worker updates row `completed`

---

## Observability

If `OTEL_EXPORTER_OTLP_ENDPOINT` set, Celery instrumented in `telemetry.py` — traces appear in Tempo.

---

## Failure modes

- Worker down → submissions stay `pending` forever (mention in viva)
- No retry policy configured in depth — could be future work

---

## Rubric

- **R10** — batch + BPMN in report
- **R5** — Redis as broker (third use of Redis)

See [[Assignments Submissions Grades]], [[Rubric R1-R13 Evidence]].
