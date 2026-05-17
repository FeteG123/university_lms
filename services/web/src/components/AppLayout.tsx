import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BrandIcon } from "./BrandIcon";

function roleLabel(role: string): string {
  if (role === "admin") {
    return "Admin";
  }
  if (role === "lecturer") {
    return "Professor";
  }
  return "Student";
}

type Props = {
  children: React.ReactNode;
};

export function AppLayout({ children }: Props) {
  const { user, logout } = useAuth();

  if (!user) {
    return <main className="main main--bare">{children}</main>;
  }

  const label = roleLabel(user.role);

  return (
    <div className="app-layout">
      <aside className="sidebar" aria-label="Main navigation">
        <Link to="/" className="sidebar-brand">
          <span className="brand-mark">
            <BrandIcon size={20} />
          </span>
          <span className="sidebar-brand__text">Student LMS</span>
        </Link>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "sidebar-link is-active" : "sidebar-link")}>
            {user.role === "student" ? "My courses" : "Courses"}
          </NavLink>
          {user.role === "student" ? (
            <NavLink
              to="/catalog"
              className={({ isActive }) => (isActive ? "sidebar-link is-active" : "sidebar-link")}
            >
              Course catalog
            </NavLink>
          ) : null}
          {user.role === "admin" ? (
            <>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => (isActive ? "sidebar-link is-active" : "sidebar-link")}
              >
                Users
              </NavLink>
              <NavLink
                to="/admin/courses/new"
                className={({ isActive }) => (isActive ? "sidebar-link is-active" : "sidebar-link")}
              >
                Create course
              </NavLink>
            </>
          ) : null}
        </nav>

        {user.role === "admin" ? (
          <div className="sidebar-footer">
            <a className="sidebar-link sidebar-link--muted" href="/docs" target="_blank" rel="noreferrer">
              API documentation
            </a>
          </div>
        ) : null}
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__user">
            <span className="app-topbar__name">{user.full_name}</span>
            <span className={`pill pill-role pill-role--${user.role}`}>{label}</span>
          </div>
          <button type="button" className="btn btn-topbar" onClick={logout}>
            Log out
          </button>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
