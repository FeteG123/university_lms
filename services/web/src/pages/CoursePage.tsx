import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiGet, apiPost, type Assignment, type CourseDetail, type EnrolledStudent } from "../api";
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
  const [students, setStudents] = useState<EnrolledStudent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin";
  const isCourseProfessor =
    user?.role === "lecturer" && course != null && course.instructor_id === user.id;
  const canViewRoster = isCourseProfessor || isAdmin;

  async function reload() {
    const c = await apiGet<CourseDetail>(`/courses/${courseId}`);
    setCourse(c);
    const professorOrEnrolled = c.is_enrolled;
    if (professorOrEnrolled) {
      const a = await apiGet<Assignment[]>(`/courses/${courseId}/assignments`);
      setAssignments(a);
    } else {
      setAssignments([]);
    }
    const staff =
      (user?.role === "lecturer" && c.instructor_id === user.id) || user?.role === "admin";
    if (staff) {
      const roster = await apiGet<EnrolledStudent[]>(`/courses/${courseId}/enrollments`);
      setStudents(roster);
    } else {
      setStudents(null);
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
    <div className="page-stack">
      {err ? <p className="err">{err}</p> : null}
      {!course ? <p className="muted">Loading…</p> : null}
      {course ? (
        <>
          <div className="card">
            <h2>
              {course.code} — {course.title}
            </h2>
            {course.description ? <p>{course.description}</p> : null}
            <p className="muted" style={{ margin: "0.5rem 0 0" }}>
              Professor: <strong>{course.instructor_name}</strong>
            </p>
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
            <div className="card">
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
          {canViewRoster ? (
            <div className="card">
              <h2>Enrolled students</h2>
              {students === null ? <p className="muted">Loading roster…</p> : null}
              {students && students.length === 0 ? (
                <p className="muted">No students enrolled yet.</p>
              ) : null}
              {students && students.length > 0 ? (
                <table className="grade-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.user_id}>
                        <td>{s.full_name}</td>
                        <td>{s.email}</td>
                        <td>{new Date(s.enrolled_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
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
            {isCourseProfessor ? <CreateAssignmentForm courseId={courseId} onCreated={reload} /> : null}
          </div>
        </>
      ) : null}
      <Link to="/" className="back-link">
        ← All courses
      </Link>
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
    <form onSubmit={submit} className="form-divider">
      <h3>New assignment</h3>
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
