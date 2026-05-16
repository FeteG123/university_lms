import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { CoursesPage } from "./pages/CoursesPage";
import { CoursePage } from "./pages/CoursePage";
import { AssignmentPage } from "./pages/AssignmentPage";
import { LecturePage } from "./pages/LecturePage";
import { GradesPage } from "./pages/GradesPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { LoginPage } from "./pages/LoginPage";
import "./App.css";

export function usePositiveIntParam(key: "courseId" | "assignmentId"): number {
  const p = useParams();
  const raw = p[key];
  const n = raw ? Number.parseInt(String(raw), 10) : NaN;
  if (!Number.isFinite(n) || n < 1) {
    return 0;
  }
  return n;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <p className="muted">Loading session…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="top">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          LMS Lite
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {user.full_name} ({user.role})
              </span>
              <Link to="/">Courses</Link>
              {user.role === "admin" ? <Link to="/admin/users">Users</Link> : null}
              <button type="button" className="btn" onClick={logout}>
                Log out
              </button>
            </>
          ) : null}
          <a href="/docs" target="_blank" rel="noreferrer">
            API docs
          </a>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <CoursesPage />
              </Protected>
            }
          />
          <Route
            path="/courses/:courseId"
            element={
              <Protected>
                <CoursePage />
              </Protected>
            }
          />
          <Route
            path="/courses/:courseId/lecture"
            element={
              <Protected>
                <LecturePage />
              </Protected>
            }
          />
          <Route
            path="/courses/:courseId/grades"
            element={
              <Protected>
                <GradesPage />
              </Protected>
            }
          />
          <Route
            path="/assignments/:assignmentId"
            element={
              <Protected>
                <AssignmentPage />
              </Protected>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Protected>
                <AdminUsersPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
