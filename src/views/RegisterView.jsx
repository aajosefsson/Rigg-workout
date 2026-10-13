import { useState, useEffect } from "react";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { db, auth } from "../firebase";
import { roleLabel, normCode } from "../lib/invites";

// ─── REGISTER (via invite) ─────────────────────────────────────────────────────
export function RegisterView({
  initialCode,
  authUser,
  onLogout,
  onBegin,
  onAbort,
  onDone,
  onBackToLogin,
}) {
  const [code, setCode] = useState(initialCode || "");
  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [working, setWorking] = useState(false);

  const checkCode = async (raw) => {
    const c = normCode(raw);
    setErr("");
    setInvite(null);
    if (c.length < 10) {
      setErr("Enter the full invite code.");
      return;
    }
    setChecking(true);
    try {
      const snap = await getDoc(doc(db, "invites", c));
      if (!snap.exists()) setErr("That invite code wasn't found.");
      else {
        const d = snap.data();
        const exp = d.expiresAt?.toMillis ? d.expiresAt.toMillis() : 0;
        if (d.used) setErr("This invite has already been used.");
        else if (exp < Date.now())
          setErr("This invite has expired. Ask for a new one.");
        else {
          setInvite({ code: c, ...d });
          setName(d.inviteeName || "");
          setEmail(d.inviteeEmail || "");
        }
      }
    } catch {
      setErr("Could not check the code. Check your connection and try again.");
    }
    setChecking(false);
  };

  useEffect(() => {
    if (initialCode)
      checkCode(
        initialCode,
      ); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const friendly = (code) =>
    ({
      "auth/email-already-in-use":
        "An account with this email already exists. Try signing in instead.",
      "auth/invalid-email": "That doesn't look like a valid email address.",
      "auth/weak-password":
        "Choose a stronger password (at least 8 characters).",
      "auth/network-request-failed": "Network problem. Check your connection.",
      "permission-denied":
        "This invite can't be used. It may have just been used or have expired.",
    })[code] || "Could not create the account. Please try again.";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) {
      setErr("Enter your name.");
      return;
    }
    if (!email.trim()) {
      setErr("Enter your email.");
      return;
    }
    if (pass.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pass !== pass2) {
      setErr("The passwords don't match.");
      return;
    }
    setWorking(true);
    onBegin();
    let cred = null;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const uid = cred.user.uid;
      const batch = writeBatch(db);
      const profileData = {
        role: invite.role,
        orgId: invite.orgId,
        name: name.trim(),
        email: (cred.user.email || "").toLowerCase(),
        active: true,
        createdBy: invite.createdBy,
        inviteCode: invite.code,
        createdAt: serverTimestamp(),
      };
      if (invite.coachId) profileData.coachId = invite.coachId;
      batch.set(doc(db, "users", uid), profileData);
      batch.update(doc(db, "invites", invite.code), {
        used: true,
        usedBy: uid,
        usedAt: serverTimestamp(),
      });
      await batch.commit();
      await onDone();
    } catch (ex) {
      if (cred?.user) {
        try {
          await deleteUser(cred.user);
        } catch (cleanupErr) {
          console.warn(
            "Could not remove the half-created account:",
            cleanupErr,
          );
        }
      } // never leave a half-created account behind
      onAbort();
      setWorking(false);
      setErr(friendly(ex.code));
    }
  };

  const shell = (children) => (
    <div className="login-wrap" style={{ position: "relative", zIndex: 1 }}>
      {children}
    </div>
  );

  if (authUser && !working) {
    return shell(
      <div className="login-card text-center">
        <h2 style={{ fontSize: "1.6rem", color: "#FF6B1A" }}>
          ALREADY SIGNED IN
        </h2>
        <p className="muted small mt-2">
          You're signed in as {authUser.email}. Log out first to register with
          an invite.
        </p>
        <button className="btn btn-ghost mt-4" onClick={onLogout}>
          Log out
        </button>
      </div>,
    );
  }

  if (working) {
    return shell(
      <div className="login-card text-center">
        <h2 style={{ fontSize: "1.6rem", color: "#FF6B1A" }}>
          CREATING YOUR ACCOUNT…
        </h2>
        <p className="muted small mt-2">This only takes a moment.</p>
      </div>,
    );
  }

  if (!invite) {
    return shell(
      <div className="login-card">
        <div className="text-center mb-4">
          <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>⚡</div>
          <h2 style={{ fontSize: "1.8rem", color: "#FF6B1A" }}>
            JOIN WITH AN INVITE
          </h2>
          <p className="muted small mt-1">Enter the code you were given</p>
        </div>
        <label htmlFor="invite-code">Invite code</label>
        <input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="xxxxx-xxxxx-xxxxx-xxxxx"
          autoComplete="off"
          onKeyDown={(e) => e.key === "Enter" && checkCode(code)}
          style={{ fontFamily: "monospace" }}
        />
        {err && (
          <div
            style={{ color: "#ff7070", fontSize: "0.82rem", marginTop: "10px" }}
          >
            {err}
          </div>
        )}
        <button
          className="btn btn-primary w-full mt-4"
          disabled={checking}
          style={{
            justifyContent: "center",
            padding: "12px",
            opacity: checking ? 0.6 : 1,
          }}
          onClick={() => checkCode(code)}
        >
          {checking ? "Checking…" : "Continue →"}
        </button>
        <div className="text-center mt-3">
          <button className="btn btn-ghost btn-xs" onClick={onBackToLogin}>
            Back to sign in
          </button>
        </div>
      </div>,
    );
  }

  return shell(
    <form className="login-card" onSubmit={submit}>
      <div className="text-center mb-4">
        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>⚡</div>
        <h2 style={{ fontSize: "1.8rem", color: "#FF6B1A" }}>
          JOIN {String(invite.orgName || "").toUpperCase()}
        </h2>
        <p className="muted small mt-1">
          {invite.createdByName || "Your coach"} invited you as a{" "}
          <strong style={{ color: "#f0ebe3" }}>{roleLabel(invite.role)}</strong>
        </p>
      </div>
      <div className="mt-3">
        <label htmlFor="reg-name">Your name</label>
        <input
          id="reg-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Full name"
        />
      </div>
      <div className="mt-3">
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          readOnly={!!invite.inviteeEmail}
          style={invite.inviteeEmail ? { opacity: 0.75 } : undefined}
        />
        {invite.inviteeEmail && (
          <p className="muted small mt-1">
            This invite was sent to this address.
          </p>
        )}
      </div>
      <div className="mt-3">
        <label htmlFor="reg-pass">Choose a password</label>
        <input
          id="reg-pass"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <div className="mt-3">
        <label htmlFor="reg-pass2">Repeat password</label>
        <input
          id="reg-pass2"
          type="password"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          autoComplete="new-password"
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
      <button
        type="submit"
        className="btn btn-primary w-full mt-4"
        style={{ justifyContent: "center", padding: "12px" }}
      >
        Create account →
      </button>
    </form>,
  );
}
