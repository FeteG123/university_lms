# REST API Reference

#api

Base URL: `https://your-host/api` (or `/api` same-origin from SPA)  
OpenAPI: `/docs`

All paths below are prefixed with `/api` unless noted.

---

## Health (no /api prefix)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health/live` | no |
| GET | `/health/ready` | no (checks Postgres + Redis) |

File: `services/api/app/main.py`

---

## Auth — `routers/auth.py`

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/login` | `{ email, password }` | `{ access_token, token_type }` |
| GET | `/auth/me` | Bearer | current user |

---

## Users (admin) — `routers/users.py`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/users` | `?q=` search email/name |
| POST | `/users` | create user |
| PATCH | `/users/{id}` | update role, active |
| DELETE | `/users/{id}` | soft deactivate |

---

## Courses — `routers/courses.py`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/courses` | Role-filtered; `?q=` code/title; students: `?catalog=true`; admin cache `X-Cache` |
| POST | `/courses` | admin; body includes `max_enrollment` |
| PATCH | `/courses/{id}` | admin; title, description, instructor, max_enrollment |
| GET | `/courses/{id}` | detail + `is_enrolled`, `is_full`, counts |
| POST | `/courses/{id}/enrollments` | student self `{}` or staff `{ user_id }` |
| GET | `/courses/{id}/enrollments` | staff roster |
| DELETE | `/courses/{id}/enrollments/{student_user_id}` | staff unenroll |
| GET | `/courses/{id}/lecture/messages` | chat history JSON |
| GET | `/courses/{id}/assignments` | list |
| POST | `/courses/{id}/assignments` | lecturer create |

---

## Materials — `routers/materials.py` (prefix `/courses`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/{course_id}/materials` | list |
| POST | `/{course_id}/materials` | multipart: kind, title, file/url/note |
| DELETE | `/{course_id}/materials/{id}` | professor/admin |
| GET | `/{course_id}/materials/{id}/file` | download file (Bearer required) |

Files on volume `submission_data` via `services/material_storage.py`.

---

## Assignments — `routers/assignments.py`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/assignments/{id}` | metadata + instructor_id |
| POST | `/assignments/{id}/submissions` | multipart text/file; upsert; enqueues Celery |
| GET | `/assignments/{id}/submissions` | student: own; staff: all |

---

## Submissions — `routers/submissions.py`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/submissions/by-public/{public_id}` | Snowflake public id |
| GET | `/submissions/{id}` | internal id |
| GET | `/submissions/{id}/file` | download attachment |

---

## Grades — `routers/grades.py`

| Method | Path | Notes |
|--------|------|-------|
| POST | `/grades` | `{ submission_id, score, feedback }` |
| GET | `/courses/{id}/grades` | enrolled students / staff |
| GET | `/courses/{id}/grades/export` | CSV download |

---

## WebSocket (not under /api)

| Path | File |
|------|------|
| `WS /ws/lectures/{course_id}?token=` | `ws/lecture.py` |

See [[WebSocket Lecture Chat]].

---

## Common HTTP errors

| Code | When |
|------|------|
| 401 | missing/invalid JWT |
| 403 | wrong role or not enrolled |
| 404 | missing resource |
| 409 | duplicate course code, course full, already enrolled |
| 429 | rate limiter |

---

## Rubric

- **R4** — this table + Swagger = endpoint documentation (**R13**)
- **R13** — keep OpenAPI in sync after changes

See [[Rubric R1-R13 Evidence]].
