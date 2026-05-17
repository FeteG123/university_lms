import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, materialFileUrl, type CourseMaterial } from "../api";
import { ELLIPSIS } from "../lib/text";
import { CourseSection } from "./CourseSection";

type Props = {
  courseId: number;
  canManage: boolean;
  canView: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function CourseMaterialsSection({
  courseId,
  canManage,
  canView,
  collapsible = true,
  defaultOpen = false,
}: Props) {
  const [materials, setMaterials] = useState<CourseMaterial[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await apiGet<CourseMaterial[]>(`/courses/${courseId}/materials`);
    setMaterials(list);
  }, [courseId]);

  useEffect(() => {
    if (!canView) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load materials");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, load]);

  if (!canView) {
    return null;
  }

  async function remove(m: CourseMaterial) {
    if (!window.confirm(`Delete material "${m.title}"?`)) {
      return;
    }
    setErr(null);
    try {
      await apiDelete(`/courses/${courseId}/materials/${m.id}`);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Delete failed");
    }
  }

  const count = materials?.length ?? 0;

  return (
    <CourseSection
      title="Course materials"
      badge={count}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      actions={
        canManage ? (
          <Link to={`/courses/${courseId}/materials/new`} className="btn btn-primary">
            + Add material
          </Link>
        ) : undefined
      }
    >
      {err ? <p className="err">{err}</p> : null}
      {materials === null ? <p className="muted empty-hint">Loading materials{ELLIPSIS}</p> : null}
      {materials && materials.length === 0 ? (
        <p className="muted empty-hint">No materials posted yet.</p>
      ) : null}
      {materials && materials.length > 0 ? (
        <ul className="material-list">
          {materials.map((m) => (
            <li key={m.id} className="material-card">
              <div className="material-card__head">
                <strong className="material-card__title">{m.title}</strong>
                <span className="pill pill-muted">{m.kind}</span>
              </div>
              {m.description ? <p className="material-card__desc">{m.description}</p> : null}
              {m.kind === "note" && m.body_text ? (
                <pre className="material-card__note">{m.body_text}</pre>
              ) : null}
              {m.kind === "link" && m.external_url ? (
                <a className="material-card__link" href={m.external_url} target="_blank" rel="noreferrer">
                  {m.external_url}
                </a>
              ) : null}
              {m.kind === "file" && m.file_name ? (
                <p className="material-card__file">
                  <a href={materialFileUrl(courseId, m.id)} target="_blank" rel="noreferrer">
                    Download {m.file_name}
                  </a>
                  {m.file_size_bytes != null ? (
                    <span className="muted"> ({Math.round(m.file_size_bytes / 1024)} KB)</span>
                  ) : null}
                </p>
              ) : null}
              <p className="material-card__meta">
                Added by {m.created_by_name} {"\u00b7"} {new Date(m.created_at).toLocaleString()}
              </p>
              {canManage ? (
                <button type="button" className="btn btn-sm" onClick={() => void remove(m)}>
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </CourseSection>
  );
}
