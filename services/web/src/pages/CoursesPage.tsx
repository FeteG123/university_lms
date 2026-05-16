import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, type Course } from "../api";
import { useAuth } from "../auth/AuthContext";

export function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const canCreate = user?.role === "lecturer" || user?.role === "admin";

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
    <div className="card">
      <h2>{user?.role === "student" ? "Courses" : "My courses"}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Signed in as {user?.full_name} ({user?.role})
        {user?.role === "student" ? (
          <>
            {" "}
            · Open a course, then use <strong>Enroll</strong> to join it.
          </>
        ) : null}
      </p>
      {err ? <p className="err">{err}</p> : null}
      {!courses && !err ? <p className="muted">Loading…</p> : null}
      {courses && courses.length === 0 ? (
        <p className="muted">
          {user?.role === "student"
            ? "No courses in the catalog yet. Ask your instructor to create one."
            : "No courses yet. Run seed or create a course (lecturer)."}
        </p>
      ) : null}
      {courses && courses.length > 0 ? (
        <ul className="list">
          {courses.map((c) => (
            <li key={c.id}>
              <Link to={`/courses/${c.id}`}>
                <strong>{c.code}</strong> — {c.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {canCreate ? (
        <CreateCourseForm
          onCreated={async () => {
            const list = await apiGet<Course[]>("/courses");
            setCourses(list);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateCourseForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiPost<Course>("/courses", {
        code,
        title,
        description: null,
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
    <form onSubmit={submit} style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Create course</h2>
      <div className="field">
        <label htmlFor="ccode">Code</label>
        <input id="ccode" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="CS401" />
      </div>
      <div className="field">
        <label htmlFor="ctitle">Title</label>
        <input id="ctitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      {err ? <p className="err">{err}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create course"}
      </button>
    </form>
  );
}
