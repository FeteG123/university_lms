import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiGet, apiPost, type Assignment, type CourseDetail } from "../api";
import { useAuth } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";

export function CoursePage() {
  const courseId = usePositiveIntParam("courseId");
  if (!courseId) {
    return <Navigate to="/" replace />;
  }
  return <CoursePageContent courseId={courseId} />;
}

function CoursePageContent({ courseId }: { courseId: number }) {
  const { user } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const isLecturer = user?.role === "lecturer" || user?.role === "admin";
  const isStudent = user?.role === "student";

  async function reload() {
    const c = await apiGet<CourseDetail>(`/courses/${courseId}`);
    setCourse(c);
    if (c.is_enrolled) {
      const a = await apiGet<Assignment[]>(`/courses/${courseId}/assignments`);
      setAssignments(a);
    } else {
      setAssignments([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function enroll() {
    setErr(null);
    try {
      const res = await apiPost<{ enrollment_id: number; status: string }>(
        `/courses/${courseId}/enrollments`,
        {},
      );
      if (res.status === "already_enrolled") {
        setErr("You are already enrolled in this course.");
      }
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Enroll failed";
      if (msg.includes("already_enrolled") || msg.includes("409")) {
        setErr("You are already enrolled in this course.");
        return;
      }
      setErr(msg);
    }
  }

  return (
    <div>
      {err ? <p className="err">{err}</p> : null}
      {!course ? <p className="muted">Loading…</p> : null}
      {course ? (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>
              {course.code} — {course.title}
            </h2>
            {course.description ? <p>{course.description}</p> : null}
            <div className="row" style={{ marginTop: "1rem" }}>
              {isStudent && !course.is_enrolled ? (
                <p className="muted" style={{ margin: 0 }}>
                  Enroll below to access lecture chat, grades, and assignments.
                </p>
              ) : (
                <>
                  <Link className="btn btn-primary" to={`/courses/${courseId}/lecture`}>
                    Live lecture chat
                  </Link>
                  <Link className="btn" to={`/courses/${courseId}/grades`}>
                    Grades
                  </Link>
                </>
              )}
            </div>
          </div>
          {isStudent ? (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h2>Enrollment</h2>
              {course.is_enrolled ? (
                <p className="muted" style={{ margin: 0 }}>
                  You are enrolled in this course.
                </p>
              ) : (
                <button type="button" className="btn btn-primary" onClick={enroll}>
                  Enroll in this course
                </button>
              )}
            </div>
          ) : null}
          <div className="card">
            <h2>Assignments</h2>
            {isStudent && !course.is_enrolled ? (
              <p className="muted">Enroll to view and submit assignments.</p>
            ) : null}
            {(!isStudent || course.is_enrolled) && assignments.length === 0 ? (
              <p className="muted">No assignments for this course.</p>
            ) : null}
            {(!isStudent || course.is_enrolled) && assignments.length > 0 ? (
              <ul className="list">
                {assignments.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assignments/${a.id}`}>{a.title}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {isLecturer ? <CreateAssignmentForm courseId={courseId} onCreated={reload} /> : null}
          </div>
        </>
      ) : null}
      <p style={{ marginTop: "1rem" }}>
        <Link to="/">← All courses</Link>
      </p>
    </div>
  );
}

function CreateAssignmentForm({ courseId, onCreated }: { courseId: number; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiPost<Assignment>(`/courses/${courseId}/assignments`, {
        title,
        description: null,
        due_at: null,
      });
      setTitle("");
      await onCreated();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>New assignment</h3>
      <div className="field">
        <label htmlFor="atitle">Title</label>
        <input id="atitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      {err ? <p className="err">{err}</p> : null}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? "Saving…" : "Add assignment"}
      </button>
    </form>
  );
}
