# Frontend React Application

#frontend

**Root:** `services/web/src/`  
**Build:** Vite → copied to `services/api/static/` in Docker image  
**Served:** same origin as API (no CORS for `/api`)

---

## Bootstrap

| File | Role |
|------|------|
| `main.tsx` | React root, `BrowserRouter`, `AuthProvider` |
| `App.tsx` | Route table + `Protected` guard |
| `theme.css` / `App.css` | Green university theme |

---

## Auth flow

1. `LoginPage` → `AuthContext.login` → `POST /api/auth/login`
2. Token → `localStorage` key `lms_token`
3. `GET /api/auth/me` on load
4. All API calls: `Authorization: Bearer` via `api.ts`

---

## Layout

`AppLayout.tsx`:

- **Left sidebar:** Courses, Catalog (student), Users + Create course (admin), API docs link (admin only)
- **Top bar:** user name + role pill + **Log out** (right)
- Replaces old crowded top nav

---

## Routes

| Path | Page | Roles |
|------|------|-------|
| `/login` | LoginPage | public |
| `/` | CoursesPage | all |
| `/catalog` | CoursesPage (catalog mode) | student |
| `/courses/:id` | CoursePage | all (scoped by API) |
| `/courses/:id/lecture` | LecturePage | enrolled/staff |
| `/courses/:id/grades` | GradesPage | enrolled/staff |
| `/courses/:id/assignments/new` | CreateAssignmentPage | lecturer |
| `/courses/:id/materials/new` | CreateMaterialPage | lecturer/admin |
| `/assignments/:id` | AssignmentPage | submit/grade |
| `/admin/users` | AdminUsersPage | admin |
| `/admin/users/new` | AdminCreateUserPage | admin |
| `/admin/courses/new` | AdminCreateCoursePage | admin |

---

## Key components

| Component | Use |
|-----------|-----|
| `CollapsibleCard` | Roster, materials, assignments (staff); expandable sections |
| `CourseSection` | Flat sections for enrolled students |
| `SearchableSelect` | Professor/student pickers (type to filter) |
| `CourseMaterialsSection` | List/upload link to create page |

---

## API client

`api.ts`:

- `apiGet`, `apiPost`, `apiPatch`, `apiDelete`, `apiPostForm`
- Parses FastAPI `detail` errors for user messages
- Types: `Course`, `CourseDetail`, `Submission`, etc.

---

## Rubric

- **R4** — UI consumes REST
- **R13** — README documents optional `npm run dev`

Not a separate rubric row but supports scenario demo.

See [[Authentication and Authorization]], [[Demo Script]].
