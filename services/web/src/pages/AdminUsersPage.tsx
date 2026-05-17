import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, type UserRow } from "../api";
import { useAuth } from "../auth/AuthContext";

export function AdminUsersPage() {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <AdminUsersPageContent />;
}

function AdminUsersPageContent() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const reload = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQ) {
      params.set("q", debouncedQ);
    }
    if (roleFilter) {
      params.set("role", roleFilter);
    }
    const qs = params.toString();
    const list = await apiGet<UserRow[]>(qs ? `/users?${qs}` : "/users");
    setRows(list);
  }, [debouncedQ, roleFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load users");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function deactivate(id: number) {
    setErr(null);
    setOk(null);
    try {
      await apiDelete(`/users/${id}`);
      setOk("User deactivated.");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Deactivate failed");
    }
  }

  async function reactivate(id: number) {
    setErr(null);
    setOk(null);
    try {
      await apiPatch<UserRow>(`/users/${id}`, { is_active: true });
      setOk("User reactivated.");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Reactivate failed");
    }
  }

  return (
    <div className="page-stack">
      {err ? <p className="err">{err}</p> : null}
      {ok ? <p className="ok-msg">{ok}</p> : null}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Users</h2>
            <p className="muted" style={{ margin: 0 }}>
              Manage accounts for students, professors, and administrators.
            </p>
          </div>
          <Link to="/admin/users/new" className="btn btn-primary">
            + Create user
          </Link>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label htmlFor="user-search">Search users</label>
            <input
              id="user-search"
              type="search"
              placeholder="Email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "0 0 140px" }}>
            <label htmlFor="user-role-filter">Role</label>
            <select id="user-role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All</option>
              <option value="student">Student</option>
              <option value="lecturer">Professor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        {!rows ? <p className="muted">Loading…</p> : null}
        {rows && rows.length === 0 ? (
          <p className="muted">{debouncedQ || roleFilter ? "No users match your filters." : "No users."}</p>
        ) : null}
        {rows && rows.length > 0 ? (
          <table className="grade-table" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.full_name}</td>
                  <td>{u.role}</td>
                  <td>{u.is_active ? <span className="pill pill-ok">active</span> : <span className="pill pill-warn">inactive</span>}</td>
                  <td>
                    {u.id === user?.id ? (
                      <span className="muted">You</span>
                    ) : u.is_active ? (
                      <button type="button" className="btn" onClick={() => void deactivate(u.id)}>
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={() => void reactivate(u.id)}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <Link to="/" className="back-link">
        ← Courses
      </Link>
    </div>
  );
}
