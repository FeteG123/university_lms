# Assignments, Submissions, and Grades

#api #celery

**Files:**

- `services/api/app/routers/courses.py` — create assignment under course
- `services/api/app/routers/assignments.py` — submit, list
- `services/api/app/routers/submissions.py` — lookup by id / public_id
- `services/api/app/routers/grades.py` — grade + export
- `services/api/app/celery_worker.py` — plagiarism task
- `services/api/app/services/file_storage.py` — submission files on disk

---

## Create assignment

`POST /api/courses/{course_id}/assignments` — lecturer of that course only.

Fields: `title`, `description`, `due_at` (optional datetime).

---

## Submit assignment `POST /api/assignments/{id}/submissions`

Multipart form: optional `body_text`, optional `file`.

### Steps

1. Load assignment + course; `_assert_enrolled` for student
2. Look for existing submission `(assignment_id, student_id)`
3. If exists → **update** same row (`replaced: true` in response); else **insert**
4. Assign new **`public_id`** from Snowflake only on first create
5. Save file to `SUBMISSION_STORAGE_PATH/{assignment_id}/{student_id}/...`
6. Set `plagiarism_status = pending`
7. `analyze_submission_task.delay(sub.id)` — Celery async
8. Commit

See [[Celery Plagiarism Pipeline]], [[Snowflake IDs and Rate Limiter]].

---

## List submissions `GET /api/assignments/{id}/submissions`

- **Student:** only own submission
- **Lecturer / admin:** all submissions with student name/email, grade fields joined

---

## Grade `POST /api/grades`

Body: `submission_id`, `score`, `feedback` (optional).

- Upsert `grades` row (unique on `submission_id`)
- Lecturer must own course or admin

---

## Grades list + CSV

- `GET /api/courses/{id}/grades` — JSON for UI
- `GET /api/courses/{id}/grades/export` — `text/csv` attachment

---

## Public submission ID (R11)

- `public_id` is Snowflake int — exposed as **string** in JSON (JS safe)
- `GET /api/submissions/by-public/{public_id}` — shareable link style lookup

---

## Frontend

| Page | Path |
|------|------|
| CreateAssignmentPage | `/courses/:id/assignments/new` |
| AssignmentPage | `/assignments/:id` — submit + professor grading UI |
| GradesPage | `/courses/:id/grades` |

---

## Rubric

- **R10** — Celery after submit
- **R11** — Snowflake on submission
- **R1** — use case: submit + grade

See [[Celery Plagiarism Pipeline]], [[Rubric R1-R13 Evidence]].
