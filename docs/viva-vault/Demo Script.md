# Demo Script

#demo

Use [[Demo Accounts]] — password `demo1234`.

**Order:** ~12 minutes for examiner.

---

## 1. Infrastructure (Person 4) — 2 min

- Show `docker compose ps` on VM (or diagram in PDF)
- Open http://university-lms.mooo.com/health/ready → postgres + redis ok
- Mention Traefik → 2 API replicas
- Optional: `/docs` Swagger

---

## 2. Admin (Person 1 + 4) — 3 min

Login: `admin@example.edu`

- **Courses** — list shows `N / M students`; search by code
- **Create course** — set max enrollment (e.g. 10)
- **Users** — list, search
- **Course** → administration: change professor, max seats
- **Enroll student** via searchable select
- Sidebar: API documentation link (admin only)

---

## 3. Professor (Person 2) — 3 min

Login: `prof2@example.edu` (Elena — has MATH201, CS210)

- Open course → **materials** (add link or note)
- **Create assignment** with due date
- Open assignment → show submissions list (if seed has any)
- **Grade** a submission
- **CSV export** from grades page

---

## 4. Student (Person 2) — 2 min

Login: `student@example.edu`

- **My courses** vs **Course catalog**
- Enroll in course with seats (not MATH201 if full)
- **Submit** assignment (text or file)
- Refresh → plagiarism status moves pending → completed

---

## 5. Live chat (Person 3) — 2 min

- Student or prof: **Live lecture chat**
- Send message; optional second browser/incognito as another user
- Explain: saved in Postgres, broadcast via Redis for replicas

---

## 6. Plagiarism + cache (Person 3) — 2 min

- Explain Celery worker container logs
- Admin: `GET /api/courses` twice — show `X-Cache` HIT (browser devtools network)

---

## 7. R11 + R12 (optional) — 2 min

- Show `public_id` on submission in API or DB
- Local Grafana screenshot from observability profile (if not on VM)

---

## Backup if live site down

- Local `docker compose up`
- Same flows on localhost

---

## After demo questions

Point examiner to [[Rubric R1-R13 Evidence]] and PDF BPMN/ER diagrams.
