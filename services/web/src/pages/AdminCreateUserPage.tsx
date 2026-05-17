import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { apiPost, type UserRow } from "../api";
import { useAuth } from "../auth/AuthContext";

export function AdminCreateUserPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "lecturer" | "admin">("student");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiPost<UserRow>("/users", {
        email: email.trim(),
        full_name: fullName.trim(),
        password,
        role,
      });
      navigate("/admin/users");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="card">
        <h2>Create user</h2>
        <p className="card-lead muted">
          New accounts are stored in PostgreSQL with a bcrypt password hash (minimum 8 characters).
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="u-email">Email</label>
            <input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="u-name">Full name</label>
            <input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
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
          <div className="field">
            <label htmlFor="u-role">Role</label>
            <select id="u-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="student">Student</option>
              <option value="lecturer">Professor (lecturer)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          {err ? <p className="err">{err}</p> : null}
          <div className="row" style={{ marginTop: "1rem", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Create user"}
            </button>
            <Link to="/admin/users" className="btn">
              Cancel
            </Link>
          </div>
        </form>
      </div>
      <Link to="/admin/users" className="back-link">
        ← All users
      </Link>
    </div>
  );
}
