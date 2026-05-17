import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost, type UserRow } from "../api";
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
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "lecturer" | "admin">("student");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await apiGet<UserRow[]>("/users");
    setRows(list);
  }, []);

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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiPost<UserRow>("/users", {
        email,
        full_name: fullName,
        password,
        role,
      });
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("student");
      setOk("User created.");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

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
        <h2>Add user</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          New accounts are stored in PostgreSQL with a bcrypt password hash (minimum 8 characters).
        </p>
        <form onSubmit={onCreate}>
          <div className="row" style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 180px" }}>
              <label htmlFor="u-email">Email</label>
              <input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 160px" }}>
              <label htmlFor="u-name">Full name</label>
              <input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
              <label htmlFor="u-pw">Password</label>
              <input
                id="u-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "0 0 120px" }}>
              <label htmlFor="u-role">Role</label>
              <select id="u-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="student">student</option>
                <option value="lecturer">lecturer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Create user"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>All users</h2>
        {!rows ? <p className="muted">Loading…</p> : null}
        {rows && rows.length === 0 ? <p className="muted">No users.</p> : null}
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
