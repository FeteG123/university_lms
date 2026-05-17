import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, type Course, type UserRow } from "../api";
import { useAuth } from "../auth/AuthContext";

export function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<Course[]>("/courses");
        if (!cancelled) {
          setCourses(data);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-stack">
      <div className="card">
        <h2>
          {user?.role === "student"
            ? "Course catalog"
            : user?.role === "lecturer"
              ? "My courses"
              : "All courses"}
        </h2>
        <p className="card-lead">
          Welcome, {user?.full_name}.{" "}
          {user?.role === "student"
            ? "Browse courses and enroll to access lectures, assignments, and grades."
            : user?.role === "lecturer"
              ? "Courses assigned to you by the administrator."
              : "Create courses and assign a professor to each one."}
        </p>
        {err ? <p className="err">{err}</p> : null}
        {!courses && !err ? <p className="muted">Loading…</p> : null}
        {courses && courses.length === 0 ? (
          <p className="muted">
            {isAdmin ? "No courses yet. Create one below." : "No courses available yet."}
          </p>
        ) : null}
        {courses && courses.length > 0 ? (
          <ul className="list">
            {courses.map((c) => (
              <li key={c.id}>
                <Link to={`/courses/${c.id}`}>
                  <strong>{c.code}</strong> — {c.title}
                  <span className="muted" style={{ display: "block", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                    Professor: {c.instructor_name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {isAdmin ? (
          <CreateCourseForm
            onCreated={async () => {
              const list = await apiGet<Course[]>("/courses");
              setCourses(list);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function CreateCourseForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [lecturers, setLecturers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const users = await apiGet<UserRow[]>("/users");
        if (!cancelled) {
          const profs = users.filter((u) => u.role === "lecturer" && u.is_active);
          setLecturers(profs);
          if (profs.length > 0) {
            setInstructorId(String(profs[0].id));
          }
        }
      } catch {
        /* form will show error on submit if needed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const iid = Number.parseInt(instructorId, 10);
    if (!Number.isFinite(iid)) {
      setErr("Select a professor");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiPost<Course>("/courses", {
        code,
        title,
        description: null,
        instructor_id: iid,
      });
      setCode("");
      setTitle("");
      await onCreated();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-divider">
      <h3>Create course (admin)</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Assign an active lecturer account as the course professor.
      </p>
      <div className="field">
        <label htmlFor="ccode">Course code</label>
        <input id="ccode" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="CS401" />
      </div>
      <div className="field">
        <label htmlFor="ctitle">Title</label>
        <input id="ctitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="cinstructor">Professor</label>
        <select
          id="cinstructor"
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          required
          disabled={lecturers.length === 0}
        >
          {lecturers.length === 0 ? <option value="">No lecturers — create one under Users</option> : null}
          {lecturers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.email})
            </option>
          ))}
        </select>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={busy || lecturers.length === 0}>
        {busy ? "Creating…" : "Create course"}
      </button>
    </form>
  );
}
