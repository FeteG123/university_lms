# Course Materials

#api

**Router:** `services/api/app/routers/materials.py`  
**Model:** `services/api/app/models/course_material.py`  
**Storage:** `services/api/app/services/material_storage.py`  
**UI:** `CourseMaterialsSection.tsx`, `CreateMaterialPage.tsx`

---

## Kinds

| kind | Stored as |
|------|-----------|
| `file` | File on Docker volume + metadata in DB |
| `link` | `external_url` column |
| `note` | `body_text` column |

---

## Permissions

`_assert_can_view_materials`:

- Admin: always
- Lecturer: if `course.instructor_id == user.id`
- Student: if enrolled

`_assert_can_manage_materials`: lecturer of course or admin.

---

## Create `POST /api/courses/{id}/materials`

`multipart/form-data`:

- `kind`, `title`, optional `description`
- file field OR `external_url` OR `body_text` depending on kind

---

## Download `GET .../materials/{id}/file`

- Requires Bearer token + view permission
- Returns `FileResponse` from volume path

**UI caveat:** list page uses plain `<a href="/api/.../file">` without token — may fail in new tab; API itself is protected.

---

## Rubric

- Scenario extension beyond bare minimum assignments
- **R4** — document in endpoint table

See [[REST API Reference]].
