# University LMS-lite — Functional specification (MVP-focused)

**Product:** Lightweight LMS for courses, assignments, live lecture chat, plagiarism batch, and grade export.  
**Users:** Student, Lecturer, Admin (Teaching Assistant = lecturer permissions for MVP).

Full enterprise features (content modules, email verification, rubrics, admin analytics) are **out of scope for v1** — see [Tier 3](#tier-3--won't-v1--report-only).

---

## Tier 1 — Must ship (scenario + demo + rubric)

| Area | Features |
|------|----------|
| **Auth** | Login, JWT, roles: `student`, `lecturer`, `admin` |
| **Courses** | Create, list (role-filtered), view, enroll self |
| **Assignments** | Create (lecturer), text submit (student), deadlines |
| **Plagiarism** | Celery batch, status + score on submission |
| **Chat** | WebSocket lecture room per course (JWT) |
| **Grades** | Lecturer grades submission; student views own; **CSV export** per course |
| **UI** | Login, dashboard, course, assignment, lecture, grades |

**Demo passwords (seed):** all users `demo1234`

---

## Tier 2 — Should (if time)

- `lecture_sessions` entity; enrollment key
- Separate `plagiarism_reports` table; instructor review panel
- Webhook on plagiarism complete (R7)
- File upload for submissions

---

## Tier 3 — Won't v1 (report / future work)

- Course content modules (PDF/PPT versioning)
- Notifications + SMTP
- Full admin panel, audit logs, rubrics, GPA, signed PDF exports
- OAuth, email verification, avatar, password reset

---

## Core use cases (for R1 report)

1. **Student** logs in → views enrolled courses → submits assignment → sees plagiarism status → views grade.
2. **Lecturer** creates course → creates assignment → reviews submissions + similarity → assigns grade → exports CSV.
3. **Student** joins live lecture chat for enrolled course.
4. **System** enqueues plagiarism scan on submit (batch worker).
5. **Admin** lists users / manages roles (minimal).

---

## Implemented schema (evolving)

| Table | Purpose |
|-------|---------|
| `users` | email, full_name, password_hash, role |
| `courses` | code, title, instructor_id |
| `enrollments` | user_id, course_id |
| `assignments` | course_id, title, due_at |
| `submissions` | assignment_id, student_id, body_text, plagiarism_*, public_id |
| `grades` | submission_id (unique), score, feedback, graded_by |

See Alembic migrations under `services/api/alembic/versions/`.

---

## API surface (MVP)

| Method | Path | Who |
|--------|------|-----|
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| GET/POST | `/api/courses` | Auth |
| POST | `/api/courses/{id}/enrollments` | Student (self) / lecturer |
| GET/POST | `/api/courses/{id}/assignments` | Auth |
| POST | `/api/assignments/{id}/submissions` | Student |
| GET | `/api/assignments/{id}/submissions` | Student (own) / lecturer |
| POST | `/api/submissions/{id}/grade` | Lecturer / admin |
| GET | `/api/courses/{id}/grades` | Enrolled / instructor |
| GET | `/api/courses/{id}/grades/export` | Lecturer / admin (CSV) |
| WS | `/ws/lectures/{course_id}?token=` | Enrolled / instructor |

OpenAPI: `/docs`
