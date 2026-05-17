import { useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandIcon } from "../components/BrandIcon";
import { useAuth } from "../auth/AuthContext";
import "./LoginPage.css";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setErr(ex instanceof Error ? ex.message : "Sign in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__bg" aria-hidden>
        <div className="login-page__orb login-page__orb--1" />
        <div className="login-page__orb login-page__orb--2" />
        <div className="login-page__orb login-page__orb--3" />
      </div>

      <div className="login-page__card">
        <div className="login-page__icon">
          <BrandIcon size={28} />
        </div>

        <h1 className="login-page__title">Sign In</h1>
        <p className="login-page__subtitle">
          Access your courses, assignments, and academic dashboard
        </p>

        <form className="login-page__form" onSubmit={onSubmit} noValidate>
          <div className="login-page__field">
            <label className="login-page__label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              className="login-page__input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          <div className="login-page__field">
            <label className="login-page__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="login-page__input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>

          {err ? (
            <p className="login-page__error" role="alert">
              {err}
            </p>
          ) : null}

          <button type="submit" className="login-page__submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
