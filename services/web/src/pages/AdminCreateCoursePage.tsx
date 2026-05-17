import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiGet, apiPost, type Course, type UserRow } from "../api";
import { useAuth } from "../auth/AuthContext";
import { SearchableSelect, userSelectOptions } from "../components/SearchableSelect";
import { backLabel, ELLIPSIS } from "../lib/text";

export function AdminCreateCoursePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [maxEnrollment, setMaxEnrollment] = useState("30");
  const [lecturers, setLecturers] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

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
        /* shown on submit */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const iid = Number.parseInt(instructorId, 10);
    const cap = Number.parseInt(maxEnrollment, 10);
    if (!Number.isFinite(iid)) {
      setErr("Select a professor");
      return;
    }
    if (!Number.isFinite(cap) || cap < 1) {
      setErr("Enter a valid maximum enrollment (at least 1)");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const course = await apiPost<Course>("/courses", {
        code: code.trim(),
        title: title.trim(),
        description: description.trim() || null,
        instructor_id: iid,
        max_enrollment: cap,
      });
      navigate(`/courses/${course.id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="card">
        <h2>Create course</h2>
        <p className="card-lead muted">Add a new course and assign the professor who will teach it.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="ccode">Course code</label>
            <input
              id="ccode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="CS401"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="ctitle">Title</label>
            <input id="ctitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cdesc">Description (optional)</label>
            <textarea
              id="cdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short summary for students…"
            />
          </div>
          <div className="field">
            <label htmlFor="cmax">Maximum enrollment</label>
            <input
              id="cmax"
              type="number"
              min={1}
              max={500}
              value={maxEnrollment}
              onChange={(e) => setMaxEnrollment(e.target.value)}
              required
            />
          </div>
          <SearchableSelect
            id="cinstructor"
            label="Professor"
            options={userSelectOptions(lecturers)}
            value={instructorId}
            onChange={setInstructorId}
            placeholder={
              lecturers.length === 0
                ? "No active lecturers - create one under Users"
                : "Search professor by name or email..."
            }
            emptyLabel="No professors match"
            disabled={lecturers.length === 0}
            required
          />
          {err ? <p className="err">{err}</p> : null}
          <div className="row" style={{ marginTop: "1rem", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={busy || lecturers.length === 0}>
              {busy ? `Creating${ELLIPSIS}` : "Create course"}
            </button>
            <Link to="/" className="btn">
              Cancel
            </Link>
          </div>
        </form>
      </div>
      <Link to="/" className="back-link">
        {backLabel("All courses")}
      </Link>
    </div>
  );
}
