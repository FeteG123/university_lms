import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiGet, type CourseListItem } from "../api";
import { useAuth } from "../auth/AuthContext";
import { enrollmentSummary } from "../lib/course";
import { backLabel, courseLabel } from "../lib/text";

function coursesPath(catalog: boolean, isStudent: boolean, q: string): string {
  const params = new URLSearchParams();
  if (isStudent && catalog) {
    params.set("catalog", "true");
  }
  if (q) {
    params.set("q", q);
  }
  const qs = params.toString();
  return qs ? `/courses?${qs}` : "/courses";
}

export function CoursesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const catalog = location.pathname === "/catalog";
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin";
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<CourseListItem[]>(coursesPath(catalog, isStudent, debouncedQ));
        if (!cancelled) {
          setCourses(data);
          setErr(null);
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
  }, [catalog, isStudent, debouncedQ]);

  const pageTitle = isStudent
    ? catalog
      ? "Course catalog"
      : "My courses"
    : user?.role === "lecturer"
      ? "My courses"
      : "All courses";

  const pageLead = isStudent
    ? catalog
      ? "Browse all courses and open one to enroll."
      : "Courses you are enrolled in. Use the catalog to find and join more."
    : user?.role === "lecturer"
      ? "Courses assigned to you by the administrator."
      : "Open a course to manage enrollments, professors, and content.";

  return (
    <div className="page-stack">
      <div className="card courses-page">
        <div className="card-section__header card-section__header--page">
          <div>
            <h2 className="card-section__title">{pageTitle}</h2>
            <p className="card-lead">
              Welcome, {user?.full_name}. {pageLead}
            </p>
          </div>
          {isAdmin ? (
            <div className="card-section__actions">
              <Link to="/admin/courses/new" className="btn btn-primary">
                + Create course
              </Link>
            </div>
          ) : null}
        </div>

        <div className="search-panel">
          <div className="field field--search">
            <label htmlFor="course-search">Search courses</label>
            <input
              id="course-search"
              type="search"
              placeholder="Course code or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {isStudent ? (
          <div className="courses-page__nav">
            {catalog ? (
              <Link to="/" className="btn">
                {backLabel("My courses")}
              </Link>
            ) : (
              <Link to="/catalog" className="btn btn-primary">
                Browse all courses
              </Link>
            )}
          </div>
        ) : null}

        <div className="card-section__body">
          {err ? <p className="err">{err}</p> : null}
          {!courses && !err ? <p className="muted empty-hint">Loading…</p> : null}
          {courses && courses.length === 0 ? (
            <p className="muted empty-hint">
              {debouncedQ
                ? "No courses match your search."
                : isAdmin
                  ? "No courses yet."
                  : isStudent && !catalog
                    ? "You are not enrolled in any course yet. Browse the catalog to enroll."
                    : "No courses available yet."}
            </p>
          ) : null}
          {courses && courses.length > 0 ? (
            <ul className="list list--tiles">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link to={`/courses/${c.id}`} className="list-tile">
                    <span className="list-tile__title">
                      {courseLabel(c.code, c.title)}
                    </span>
                    <span className="list-tile__meta">Professor: {c.instructor_name}</span>
                    <span className="list-tile__meta">
                      {enrollmentSummary(c.enrollment_count, c.max_enrollment)}
                      {c.enrollment_count >= c.max_enrollment ? " · Full" : ""}
                    </span>
                    {isStudent && catalog && c.is_enrolled ? (
                      <span className="list-tile__badge">Enrolled</span>
                    ) : null}
                    {isStudent && catalog && !c.is_enrolled && c.enrollment_count >= c.max_enrollment ? (
                      <span className="list-tile__badge list-tile__badge--full">Full</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
