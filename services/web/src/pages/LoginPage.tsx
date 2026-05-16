import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("student@example.edu");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(email, password);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card login-card">
      <h2>Sign in</h2>
      <p className="muted">
        Demo: <code className="mono">student@example.edu</code>,{" "}
        <code className="mono">instructor@example.edu</code>, <code className="mono">admin@example.edu</code>
        <br />
        Password <code className="mono">demo1234</code>
      </p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err ? <p className="err">{err}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", marginTop: "0.5rem" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
