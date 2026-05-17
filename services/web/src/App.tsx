import { Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { BrandIcon } from "./components/BrandIcon";
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
    return (
      <div className="card loading-state">
        <p className="muted">Loading session…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return (
      <div className="app-auth">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-shell__bg" aria-hidden>
        <div className="app-shell__orb app-shell__orb--1" />
        <div className="app-shell__orb app-shell__orb--2" />
      </div>

      <div className="app-shell__inner">
        <header className="top">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <BrandIcon size={20} />
            </span>
            Student LMS
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <span className="nav-user">
                  {user.full_name} · {user.role}
                </span>
                <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-active" : undefined)}>
                  Courses
                </NavLink>
                {user.role === "admin" ? (
                  <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "nav-active" : undefined)}>
                    Users
                  </NavLink>
                ) : null}
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
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
