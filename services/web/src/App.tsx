import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { CoursesPage } from "./pages/CoursesPage";
import { CoursePage } from "./pages/CoursePage";
import { AssignmentPage } from "./pages/AssignmentPage";
import { LecturePage } from "./pages/LecturePage";
import { GradesPage } from "./pages/GradesPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminCreateUserPage } from "./pages/AdminCreateUserPage";
import { AdminCreateCoursePage } from "./pages/AdminCreateCoursePage";
import { CreateAssignmentPage } from "./pages/CreateAssignmentPage";
import { CreateMaterialPage } from "./pages/CreateMaterialPage";
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
        <AppLayout>
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
              path="/catalog"
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
              path="/courses/:courseId/assignments/new"
              element={
                <Protected>
                  <CreateAssignmentPage />
                </Protected>
              }
            />
            <Route
              path="/courses/:courseId/materials/new"
              element={
                <Protected>
                  <CreateMaterialPage />
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
            <Route
              path="/admin/users/new"
              element={
                <Protected>
                  <AdminCreateUserPage />
                </Protected>
              }
            />
            <Route
              path="/admin/courses/new"
              element={
                <Protected>
                  <AdminCreateCoursePage />
                </Protected>
              }
            />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </div>
    </div>
  );
}
