import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPostForm, type CourseDetail, type CourseMaterial } from "../api";
import { useAuth } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";

type MaterialKind = "file" | "link" | "note";

function parseKind(raw: string | null): MaterialKind {
  if (raw === "link" || raw === "note" || raw === "file") {
    return raw;
  }
  return "file";
}

export function CreateMaterialPage() {
  const courseId = usePositiveIntParam("courseId");
  if (!courseId) {
    return <Navigate to="/" replace />;
  }
  return <CreateMaterialPageContent courseId={courseId} />;
}

function CreateMaterialPageContent({ courseId }: { courseId: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [kind, setKind] = useState<MaterialKind>(() => parseKind(searchParams.get("kind")));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
    course != null &&
    (user?.role === "admin" || (user?.role === "lecturer" && course.instructor_id === user.id));

  if (course && !canCreate) {
    return <Navigate to={`/courses/${courseId}`} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("title", title.trim());
      if (description.trim()) {
        form.append("description", description.trim());
      }
      if (kind === "note") {
        form.append("body_text", bodyText.trim());
      } else if (kind === "link") {
        form.append("external_url", externalUrl.trim());
      } else if (file) {
        form.append("file", file);
      }
      await apiPostForm<CourseMaterial>(`/courses/${courseId}/materials`, form);
      navigate(`/courses/${courseId}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="card">
        <h2>Add course material</h2>
        {course ? (
          <p className="card-lead muted">
            {course.code} — {course.title}
          </p>
        ) : (
          <p className="muted">Loading course…</p>
        )}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="mat-kind">Type</label>
            <select id="mat-kind" value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
              <option value="file">File upload</option>
              <option value="link">External link</option>
              <option value="note">Text note</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="mat-title">Title</label>
            <input id="mat-title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="mat-desc">Description (optional)</label>
            <input id="mat-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {kind === "note" ? (
            <div className="field">
              <label htmlFor="mat-body">Content</label>
              <textarea
                id="mat-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={6}
                required
                placeholder="Syllabus, reading list, or lecture notes…"
              />
            </div>
          ) : null}
          {kind === "link" ? (
            <div className="field">
              <label htmlFor="mat-url">URL</label>
              <input
                id="mat-url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                required
                placeholder="https://…"
              />
            </div>
          ) : null}
          {kind === "file" ? (
            <div className="field">
              <label htmlFor="mat-file">File</label>
              <input
                id="mat-file"
                type="file"
                accept=".pdf,.txt,.md,.csv,.json,.log,.zip,.ppt,.pptx,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                Max 25 MB. PDF, Office, text, or zip.
              </p>
            </div>
          ) : null}
          {err ? <p className="err">{err}</p> : null}
          <div className="row" style={{ marginTop: "1rem", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={busy || !course}>
              {busy ? "Publishing…" : "Publish material"}
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
