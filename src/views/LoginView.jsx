import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase";

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
export function LoginView({ onRegister }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const friendly = (code) =>
    ({
      "auth/invalid-credential": "Wrong email or password.",
      "auth/invalid-email": "That doesn't look like a valid email address.",
      "auth/user-disabled":
        "This account has been disabled. Contact your admin.",
      "auth/too-many-requests":
        "Too many attempts. Wait a few minutes and try again.",
      "auth/network-request-failed": "Network problem. Check your connection.",
    })[code] || "Could not sign in. Please try again.";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    if (!email.trim() || !pass) {
      setErr("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (ex) {
      setErr(friendly(ex.code));
    }
    setBusy(false);
  };

  const reset = async () => {
    setErr("");
    setInfo("");
    if (!email.trim()) {
      setErr("Enter your email above first, then click 'Forgot password?'.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // deliberately ignored: the same message is shown either way, so nobody can find out
      // which email addresses have an account
    }
    setInfo(
      "If an account exists for that email, a password reset link has been sent.",
    );
  };

  return (
    <div className="login-wrap" style={{ position: "relative", zIndex: 1 }}>
      <form className="login-card" onSubmit={submit}>
        <div className="text-center mb-4">
          <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>⚡</div>
          <h2 style={{ fontSize: "1.8rem", color: "#FF6B1A" }}>SIGN IN</h2>
          <p className="muted small mt-1">Admins, coaches and members</p>
        </div>
        <div className="mt-4">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="mt-3">
          <label htmlFor="login-pass">Password</label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {err && (
          <div
            style={{ color: "#ff7070", fontSize: "0.82rem", marginTop: "10px" }}
          >
            {err}
          </div>
        )}
        {info && (
          <div
            style={{ color: "#7dde7d", fontSize: "0.82rem", marginTop: "10px" }}
          >
            {info}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full mt-4"
          style={{
            justifyContent: "center",
            padding: "12px",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Signing in…" : "Sign In →"}
        </button>
        <div
          className="text-center mt-3 flex gap-2"
          style={{ justifyContent: "center", flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={reset}
          >
            Forgot password?
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onRegister}
          >
            Have an invite? Register
          </button>
        </div>
      </form>
    </div>
  );
}
