import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiGet, gradesExportUrl, type GradeRow } from "../api";
import { useAuth, getStoredToken } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";

export function GradesPage() {
  const courseId = usePositiveIntParam("courseId");
  if (!courseId) {
    return <Navigate to="/" replace />;
  }
  return <GradesPageContent courseId={courseId} />;
}

function GradesPageContent({ courseId }: { courseId: number }) {
  const { user, token } = useAuth();
  const [rows, setRows] = useState<GradeRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<GradeRow[]>(`/courses/${courseId}/grades`);
        if (!cancelled) {
          setRows(data);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load grades");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function downloadCsv() {
    const t = token ?? getStoredToken();
    const r = await fetch(gradesExportUrl(courseId), {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!r.ok) {
      setErr(await r.text());
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grades_course_${courseId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canExport = user?.role === "lecturer" || user?.role === "admin";

  return (
    <div className="page-stack">
      <div className="card">
        <h2>Grades</h2>
        {err ? <p className="err">{err}</p> : null}
        {!rows ? <p className="muted">Loading…</p> : null}
        {rows && rows.length === 0 ? <p className="muted">No grades published yet.</p> : null}
        {rows && rows.length > 0 ? (
          <table className="grade-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Student</th>
                <th>Score</th>
                <th>Letter</th>
                <th>Plagiarism</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>{g.assignment_title}</td>
                  <td>{g.student_name}</td>
                  <td>{g.score}</td>
                  <td>{g.letter_grade ?? "—"}</td>
                  <td>
                    {g.plagiarism_status}
                    {g.plagiarism_score != null ? ` (${g.plagiarism_score})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {canExport ? (
          <button type="button" className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={downloadCsv}>
            Export CSV
          </button>
        ) : null}
      </div>
      <Link to={`/courses/${courseId}`} className="back-link">
        ← Back to course
      </Link>
    </div>
  );
}
