import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiGet, apiPost, type Assignment, type CourseDetail } from "../api";
import { backLabel, courseLabel, ELLIPSIS } from "../lib/text";
import { useAuth } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";

export function CreateAssignmentPage() {
  const courseId = usePositiveIntParam("courseId");
  if (!courseId) {
    return <Navigate to="/" replace />;
  }
  return <CreateAssignmentPageContent courseId={courseId} />;
}

function CreateAssignmentPageContent({ courseId }: { courseId: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await apiGet<CourseDetail>(`/courses/${courseId}`);
        if (!cancelled) {
          setCourse(c);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load course");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const canCreate =
    user?.role === "lecturer" && course != null && course.instructor_id === user.id;

  if (course && !canCreate) {
    return <Navigate to={`/courses/${courseId}`} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      let dueIso: string | null = null;
      if (dueAt) {
        const d = new Date(dueAt);
        if (Number.isNaN(d.getTime())) {
          setErr("Invalid due date");
          setBusy(false);
          return;
        }
        dueIso = d.toISOString();
      }
      const a = await apiPost<Assignment>(`/courses/${courseId}/assignments`, {
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueIso,
      });
      navigate(`/assignments/${a.id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="card">
        <h2>Create assignment</h2>
        {course ? (
          <p className="card-lead muted">
            {course.code} — {course.title}
          </p>
        ) : (
          <p className="muted">Loading course…</p>
        )}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="atitle">Title</label>
            <input
              id="atitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              placeholder="Homework 1"
            />
          </div>
          <div className="field">
            <label htmlFor="adesc">Description (optional)</label>
            <textarea
              id="adesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Instructions for students"
            />
          </div>
          <div className="field">
            <label htmlFor="adue">Due date (optional)</label>
            <input id="adue" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          {err ? <p className="err">{err}</p> : null}
          <div className="row" style={{ marginTop: "1rem", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={busy || !course}>
              {busy ? "Creating…" : "Create assignment"}
            </button>
            <Link to={`/courses/${courseId}`} className="btn">
              Cancel
            </Link>
          </div>
        </form>
      </div>
      <Link to={`/courses/${courseId}`} className="back-link">
        ← Back to course
      </Link>
    </div>
  );
}
