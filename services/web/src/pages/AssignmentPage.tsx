import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiGet, apiPost, apiPostForm, type AssignmentContext, type GradeRow, type Submission } from "../api";
import { useAuth } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";

function formatSubmittedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function AssignmentPage() {
  const assignmentId = usePositiveIntParam("assignmentId");
  if (!assignmentId) {
    return <Navigate to="/" replace />;
  }
  return <AssignmentPageContent assignmentId={assignmentId} />;
}

function AssignmentPageContent({ assignmentId }: { assignmentId: number }) {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const [assignment, setAssignment] = useState<AssignmentContext | null>(null);
  const canGrade =
    user?.role === "lecturer" &&
    assignment != null &&
    assignment.instructor_id === user.id;
  const [subs, setSubs] = useState<Submission[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lastSubmissionId, setLastSubmissionId] = useState<number | null>(null);
  const [poll, setPoll] = useState<Submission | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState<Record<number, string>>({});
  const [gradeFeedback, setGradeFeedback] = useState<Record<number, string>>({});
  async function reload() {
    const [ctx, list] = await Promise.all([
      apiGet<AssignmentContext>(`/assignments/${assignmentId}`),
      apiGet<Submission[]>(`/assignments/${assignmentId}/submissions`),
    ]);
    setAssignment(ctx);
    setSubs(list);
    const scores: Record<number, string> = {};
    const feedback: Record<number, string> = {};
    for (const s of list) {
      if (s.grade_score != null) {
        scores[s.id] = String(s.grade_score);
      }
      if (s.grade_feedback) {
        feedback[s.id] = s.grade_feedback;
      }
    }
    setGradeScore(scores);
    setGradeFeedback(feedback);
    if (user?.role === "student" && list.length > 0) {
      const mine = list[0];
      setBody(mine.body_text ?? "");
      setLastSubmissionId(mine.id);
      setPoll(mine);
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
  }, [assignmentId]);

  useEffect(() => {
    if (lastSubmissionId == null) {
      return;
    }
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const s = await apiGet<Submission>(`/submissions/${lastSubmissionId}`);
        if (!cancelled) {
          setPoll(s);
          if (s.plagiarism_status === "completed" || s.plagiarism_status === "failed") {
            window.clearInterval(id);
            await reload();
          }
        }
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [lastSubmissionId, assignmentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text && !file) {
      setErr("Enter text and/or choose a file (.txt, .md, .csv, .json, .log)");
      return;
    }
    setErr(null);
    try {
      let s: Submission;
      const form = new FormData();
      if (text) {
        form.append("body_text", text);
      }
      if (file) {
        form.append("file", file);
      }
      s = await apiPostForm<Submission>(`/assignments/${assignmentId}/submissions`, form);
      setFile(null);
      setLastSubmissionId(s.id);
      setPoll(s);
      setOkMsg(s.replaced ? "Your submission was updated with a new timestamp." : "Submitted successfully.");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Submit failed");
    }
  }

  async function gradeSubmission(submissionId: number) {
    const score = Number.parseFloat(gradeScore[submissionId] ?? "");
    if (!Number.isFinite(score)) {
      setErr("Enter a valid score");
      return;
    }
    setErr(null);
    setOkMsg(null);
    try {
      const result = await apiPost<GradeRow>("/grades", {
        submission_id: submissionId,
        score,
        feedback: gradeFeedback[submissionId] || undefined,
      });
      setGradeScore((m) => ({ ...m, [submissionId]: String(result.score) }));
      if (result.feedback) {
        setGradeFeedback((m) => ({ ...m, [submissionId]: result.feedback! }));
      }
      setOkMsg(`Graded submission #${submissionId}: score ${result.score}`);
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Grading failed");
    }
  }

  const hasSubmission = isStudent && subs.length > 0;
  const showStudentNames = !isStudent;

  return (
    <div className="page-stack">
      {err ? <p className="err">{err}</p> : null}
      {okMsg ? <p className="ok-msg">{okMsg}</p> : null}
      {isStudent ? (
        <div className="card">
          <h2>Assignment #{assignmentId}</h2>
          <p className="muted">
            {hasSubmission
              ? "You already submitted once. Submit again to replace your answer (same assignment, updated time)."
              : "Submit text and/or a file (.txt, .md, .csv, .json, .log, max 10 MB). One submission per assignment."}
          </p>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="bd">Submission text (optional if file attached)</label>
              <textarea id="bd" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your answer…" />
            </div>
            <div className="field">
              <label htmlFor="sub-file">Attachment</label>
              <input
                id="sub-file"
                type="file"
                accept=".txt,.md,.csv,.json,.log,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              {hasSubmission ? "Replace submission" : "Submit answer"}
            </button>
          </form>
          {lastSubmissionId != null && poll ? (
            <p className="muted" style={{ marginTop: "1rem" }}>
              Submitted {formatSubmittedAt(poll.submitted_at)} · id{" "}
              <span className="mono">{poll.public_id}</span> · status{" "}
              <span className="mono">{poll.plagiarism_status}</span>
              {poll.plagiarism_score != null ? ` · score ${poll.plagiarism_score}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="card">
        <h2>{isStudent ? "Your submission" : "Submissions"}</h2>
        {subs.length === 0 ? <p className="muted">None yet.</p> : null}
        <ul className="list">
          {subs.map((s) => (
            <li key={s.id} className="list-item">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  {showStudentNames && s.student_name ? (
                    <p style={{ margin: "0 0 0.25rem", fontWeight: 600, color: "var(--brand)" }}>
                      {s.student_name}
                      {s.student_email ? (
                        <span className="muted" style={{ fontWeight: 400, fontSize: "0.85rem" }}>
                          {" "}
                          · {s.student_email}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <span className="mono">#{s.public_id}</span>
                  <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                    Submitted {formatSubmittedAt(s.submitted_at)}
                  </p>
                </div>
                <span className={`pill ${s.plagiarism_status === "completed" ? "pill-ok" : "pill-warn"}`}>
                  {s.plagiarism_status}
                  {s.plagiarism_score != null ? ` ${s.plagiarism_score}` : ""}
                </span>
              </div>
              {s.body_text ? (
                <p style={{ margin: "0.35rem 0", fontSize: "0.88rem" }}>{s.body_text.slice(0, 300)}</p>
              ) : null}
              {s.file_name ? (
                <p className="muted" style={{ margin: "0.25rem 0" }}>
                  File:{" "}
                  <a href={`/api/submissions/${s.id}/file`} target="_blank" rel="noreferrer">
                    {s.file_name}
                  </a>
                  {s.file_size_bytes != null ? ` (${s.file_size_bytes} B)` : ""}
                </p>
              ) : null}
              {s.grade_score != null ? (
                <p className="ok-msg" style={{ marginTop: "0.5rem" }}>
                  {isStudent ? "Your grade" : "Grade"}: <strong>{s.grade_score}</strong>
                  {s.grade_feedback ? ` — ${s.grade_feedback}` : ""}
                </p>
              ) : null}
              {canGrade ? (
                <div className="row" style={{ marginTop: "0.5rem", alignItems: "flex-end" }}>
                  <div className="field" style={{ marginBottom: 0, flex: "0 0 80px" }}>
                    <label>Score</label>
                    <input
                      value={gradeScore[s.id] ?? ""}
                      onChange={(e) => setGradeScore((m) => ({ ...m, [s.id]: e.target.value }))}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                    <label>Feedback</label>
                    <input
                      value={gradeFeedback[s.id] ?? ""}
                      onChange={(e) => setGradeFeedback((m) => ({ ...m, [s.id]: e.target.value }))}
                    />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => gradeSubmission(s.id)}>
                    Grade
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <Link to="/" className="back-link">
        ← Courses
      </Link>
    </div>
  );
}
