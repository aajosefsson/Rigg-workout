import { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ClientPlan } from "./ClientPlan";
import { db } from "../firebase";
import {
  roleLabel,
  makeCode,
  prettyCode,
  looksLikeEmail,
  inviteMailto,
} from "../lib/invites";
import { SectionTitle } from "../components/SectionTitle";

// ─── CLIENTS (people, invites and private plans) ───────────────────────────────
export function ClientsView({ profile, authUser, org }) {
  const myRole = profile.role,
    orgId = profile.orgId,
    uid = authUser.uid;
  const [people, setPeople] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadedAt, setLoadedAt] = useState(0); // when invites were fetched; expiry is judged against this
  const [loadErr, setLoadErr] = useState("");
  const [tick, setTick] = useState(0);
  const [role, setRole] = useState("member");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [coachId, setCoachId] = useState(uid);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [created, setCreated] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openClientId, setOpenClientId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pendingCoach, setPendingCoach] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [peopleMsg, setPeopleMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const uq =
          myRole === "admin"
            ? query(collection(db, "users"), where("orgId", "==", orgId))
            : query(
                collection(db, "users"),
                where("orgId", "==", orgId),
                where("coachId", "==", uid),
              );
        const iq =
          myRole === "admin"
            ? query(collection(db, "invites"), where("orgId", "==", orgId))
            : query(
                collection(db, "invites"),
                where("orgId", "==", orgId),
                where("createdBy", "==", uid),
              );
        const [us, is] = await Promise.all([getDocs(uq), getDocs(iq)]);
        if (!cancelled) {
          setPeople(us.docs.map((d) => ({ id: d.id, ...d.data() })));
          setInvites(is.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoadedAt(Date.now());
          setLoadErr("");
        }
      } catch {
        if (!cancelled)
          setLoadErr(
            "Could not load people and invites. Check your connection and the Firestore rules.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myRole, orgId, uid, tick]);

  const nameOf = (id) =>
    id === uid
      ? profile.name || "me"
      : people.find((p) => p.id === id)?.name || "—";
  const isInactive = (p) => p.active === false;
  const activeCoaches = people.filter(
    (p) => p.role === "coach" && !isInactive(p),
  );
  const coaches = activeCoaches;
  const clients = people.filter((p) => p.role === "member");
  const activeClients = clients.filter((p) => !isInactive(p));
  const inactivePeople = people.filter(
    (p) => p.role !== "admin" && isInactive(p),
  );
  const coachOk = (cid) =>
    cid === uid || activeCoaches.some((c) => c.id === cid);
  const orphaned =
    myRole === "admin" ? activeClients.filter((c) => !coachOk(c.coachId)) : [];
  const pending = invites.filter(
    (i) =>
      !i.used && i.expiresAt?.toMillis && i.expiresAt.toMillis() > loadedAt,
  );
  const fmt = (ts) =>
    ts?.toMillis ? new Date(ts.toMillis()).toLocaleDateString("en-GB") : "";
  const linkFor = (code) => `${window.location.origin}/?invite=${code}`;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied to clipboard.");
    } catch {
      window.prompt("Copy this link:", text);
    }
  };

  const createInvite = async () => {
    setMsg("");
    const fn = firstName.trim(),
      ln = lastName.trim(),
      em = inviteeEmail.trim().toLowerCase();
    if (!fn || !ln) {
      setMsg("Enter the person's first and last name.");
      return;
    }
    if (!looksLikeEmail(em)) {
      setMsg("Enter a valid email address.");
      return;
    }
    if (people.some((p) => (p.email || "").toLowerCase() === em)) {
      setMsg("Someone with that email already has an account.");
      return;
    }
    if (
      invites.some(
        (i) =>
          !i.used &&
          (i.inviteeEmail || "").toLowerCase() === em &&
          i.expiresAt?.toMillis &&
          i.expiresAt.toMillis() > Date.now(),
      )
    ) {
      setMsg(
        "There is already a pending invite for that email. Use its Email or Copy link button below.",
      );
      return;
    }
    setBusy(true);
    try {
      const code = makeCode();
      const inviteRole = myRole === "coach" ? "member" : role;
      const data = {
        orgId,
        orgName: org?.name || orgId,
        role: inviteRole,
        createdBy: uid,
        createdByName: profile.name || authUser.email,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000),
        used: false,
        inviteeFirstName: fn,
        inviteeLastName: ln,
        inviteeName: `${fn} ${ln}`,
        inviteeEmail: em,
      };
      if (inviteRole === "member")
        data.coachId = myRole === "coach" ? uid : coachId;
      await setDoc(doc(db, "invites", code), data);
      setCreated({
        code,
        role: inviteRole,
        name: data.inviteeName,
        firstName: fn,
        email: em,
      });
      setFirstName("");
      setLastName("");
      setInviteeEmail("");
      setTick((t) => t + 1);
    } catch {
      setMsg(
        "Could not create the invite. Check your permissions and try again.",
      );
    }
    setBusy(false);
  };

  // the "Email the link" button for an invite (opens the mail app, addressed and written)
  const mailtoFor = (inv, code) =>
    inviteMailto({
      email: inv.email ?? inv.inviteeEmail,
      firstName: inv.firstName ?? inv.inviteeFirstName,
      orgName: org?.name || orgId,
      inviterName: profile.name || authUser.email,
      role: inv.role,
      link: linkFor(code),
    });

  const revoke = async (code) => {
    try {
      await deleteDoc(doc(db, "invites", code));
      setMsg("Invite revoked.");
      if (created?.code === code) setCreated(null);
      setTick((t) => t + 1);
    } catch {
      setMsg("Could not revoke the invite.");
    }
  };

  const setActive = async (person, active) => {
    setBusyId(person.id);
    setPeopleMsg("");
    try {
      await updateDoc(doc(db, "users", person.id), {
        active,
        statusChangedAt: serverTimestamp(),
        statusChangedBy: uid,
      });
      setConfirmId(null);
      setPeopleMsg(
        active
          ? `${person.name} has been reactivated.`
          : `${person.name} has been deactivated. Their sessions and results are kept.`,
      );
      setTick((t) => t + 1);
    } catch {
      setPeopleMsg(
        "Could not update that account. Check your permissions and connection.",
      );
    }
    setBusyId(null);
  };

  // Moves a client to another coach: first their sessions (in small batches), then the client's profile.
  // If something fails halfway, nothing is lost: just run the same move again.
  const reassign = async (client, newCoachId) => {
    setBusyId(client.id);
    setPeopleMsg("");
    try {
      const ws = await getDocs(
        query(
          collection(db, "clientWorkouts"),
          where("orgId", "==", orgId),
          where("clientId", "==", client.id),
        ),
      );
      const toMove = ws.docs.filter((d) => d.data().coachId !== newCoachId);
      for (let i = 0; i < toMove.length; i += 8) {
        const batch = writeBatch(db);
        toMove
          .slice(i, i + 8)
          .forEach((d) =>
            batch.update(d.ref, {
              coachId: newCoachId,
              updatedAt: serverTimestamp(),
            }),
          );
        await batch.commit();
      }
      await updateDoc(doc(db, "users", client.id), {
        coachId: newCoachId,
        statusChangedAt: serverTimestamp(),
        statusChangedBy: uid,
      });
      setPendingCoach((p) => {
        const n = { ...p };
        delete n[client.id];
        return n;
      });
      setPeopleMsg(
        `${client.name} now has ${nameOf(newCoachId)} as coach${toMove.length ? ` (${toMove.length} session${toMove.length !== 1 ? "s" : ""} moved)` : ""}.`,
      );
    } catch {
      setPeopleMsg(
        "The move didn't finish. Nothing is lost. Choose the coach again and press Save to complete it.",
      );
    }
    setTick((t) => t + 1);
    setBusyId(null);
  };

  const coachOptions = () => (
    <>
      <option value={uid}>Me ({profile.name || "admin"})</option>
      {activeCoaches.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );

  const deactivateControls = (p, warning) =>
    confirmId === p.id ? (
      <>
        {warning && (
          <span className="small" style={{ color: "#ff9c9c" }}>
            {warning}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setConfirmId(null)}
        >
          Keep
        </button>
        <button
          className="btn btn-danger btn-sm"
          disabled={busyId === p.id}
          onClick={() => setActive(p, false)}
        >
          Confirm deactivate
        </button>
      </>
    ) : (
      <button
        className="btn btn-danger btn-sm"
        onClick={() => setConfirmId(p.id)}
      >
        Deactivate
      </button>
    );

  const openClient = clients.find((c) => c.id === openClientId);
  if (openClient) {
    return (
      <ClientPlan
        client={openClient}
        profile={profile}
        authUser={authUser}
        coachName={nameOf(openClient.coachId)}
        allClients={activeClients.filter(
          (c) => myRole === "admin" || c.coachId === uid,
        )}
        onBack={() => setOpenClientId(null)}
      />
    );
  }

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "820px" }}
    >
      <div className="mb-4">
        <h1 style={{ fontSize: "2rem", color: "#FF6B1A" }}>CLIENTS</h1>
        <p className="muted small">
          {myRole === "admin"
            ? "Everyone in your organization"
            : "Your clients"}{" "}
          · open a client to plan their sessions
        </p>
      </div>

      {loadErr && (
        <div
          className="card mb-4"
          style={{ color: "#ff7070", fontSize: "0.85rem" }}
        >
          {loadErr}
        </div>
      )}

      {/* Create invite */}
      <div className="card mb-4">
        <div
          className="flex-between"
          style={{ marginBottom: inviteOpen ? "12px" : 0 }}
        >
          <h3 style={{ fontSize: "1rem", color: "#FF6B1A" }}>Invite someone</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setInviteOpen((o) => !o)}
          >
            {inviteOpen ? "Hide" : "+ New invite"}
          </button>
        </div>
        {inviteOpen && (
          <>
            <div className="grid-2">
              <div>
                <label htmlFor="inv-role">Role</label>
                {myRole === "admin" ? (
                  <select
                    id="inv-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="member">Client</option>
                    <option value="coach">Coach</option>
                  </select>
                ) : (
                  <select id="inv-role" value="member" disabled>
                    <option value="member">Client</option>
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="inv-first">First name</label>
                <input
                  id="inv-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="inv-last">Last name</label>
                <input
                  id="inv-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="inv-email">Email</label>
                <input
                  id="inv-email"
                  type="email"
                  value={inviteeEmail}
                  onChange={(e) => setInviteeEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="off"
                />
              </div>
              {myRole === "admin" && role === "member" && (
                <div>
                  <label htmlFor="inv-coach">Responsible coach</label>
                  <select
                    id="inv-coach"
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                  >
                    <option value={uid}>Me ({profile.name || "admin"})</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div
              className="flex gap-3 mt-3"
              style={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={createInvite}
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Creating…" : "Create invite"}
              </button>
              <span className="muted small">
                The invite only works for this email address, is valid for 7
                days and can be used once.
              </span>
            </div>

            {created && (
              <div
                className="card card-orange mt-4"
                style={{ padding: "14px 16px" }}
              >
                <div
                  className="small"
                  style={{ color: "#c8bfb0", marginBottom: "6px" }}
                >
                  Invite created for <strong>{created.name}</strong> (
                  {created.email}), as a {roleLabel(created.role)}.
                </div>
                <div
                  style={{
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                  }}
                >
                  {linkFor(created.code)}
                </div>
                <div
                  className="flex gap-2"
                  style={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <a
                    className="btn btn-primary btn-sm"
                    href={mailtoFor(created, created.code)}
                  >
                    ✉ Email the link
                  </a>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copy(linkFor(created.code))}
                  >
                    Copy link
                  </button>
                  <span className="muted small">
                    or code:{" "}
                    <span style={{ fontFamily: "monospace", color: "#f0ebe3" }}>
                      {prettyCode(created.code)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        {msg && (
          <p className="small mt-3" style={{ color: "#c8bfb0" }}>
            {msg}
          </p>
        )}
      </div>

      {/* Pending invites */}
      <div className="section-header mb-3">
        <h4
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            color: "#8a7a6a",
          }}
        >
          PENDING INVITES ({pending.length})
        </h4>
        <div className="section-line" />
      </div>
      {pending.length === 0 ? (
        <p className="muted small mb-4">No pending invites.</p>
      ) : (
        <div className="mb-4">
          {pending.map((i) => (
            <div
              key={i.id}
              className="card mb-2"
              style={{ padding: "12px 16px" }}
            >
              <div className="flex-between">
                <div>
                  <span className="role-badge">{roleLabel(i.role)}</span>
                  <span
                    style={{
                      marginLeft: "8px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    {i.inviteeName || "Unnamed invite"}
                  </span>
                  <div className="muted small mt-1">
                    {i.inviteeEmail ? `${i.inviteeEmail} · ` : ""}Expires{" "}
                    {fmt(i.expiresAt)}
                    {i.role === "member" && i.coachId
                      ? ` · coach: ${nameOf(i.coachId)}`
                      : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  {i.inviteeEmail && (
                    <a
                      className="btn btn-ghost btn-xs"
                      href={mailtoFor(i, i.id)}
                    >
                      ✉ Email
                    </a>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => copy(linkFor(i.id))}
                  >
                    Copy link
                  </button>
                  <button
                    className="btn btn-danger btn-xs"
                    onClick={() => revoke(i.id)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* People */}
      {peopleMsg && (
        <p className="small mb-3" style={{ color: "#c8bfb0" }}>
          {peopleMsg}
        </p>
      )}

      {myRole === "admin" && orphaned.length > 0 && (
        <>
          <SectionTitle>NEEDS A NEW COACH ({orphaned.length})</SectionTitle>
          <div className="mb-4">
            {orphaned.map((c) => (
              <div
                key={c.id}
                className="card card-orange mb-2"
                style={{ padding: "10px 16px" }}
              >
                <div className="flex-between">
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span className="muted small" style={{ marginLeft: "8px" }}>
                      {c.email}
                    </span>
                    <div className="muted small">
                      Previous coach: {nameOf(c.coachId)} (inactive)
                    </div>
                  </div>
                  <div
                    className="flex gap-2"
                    style={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <select
                      aria-label={`New coach for ${c.name}`}
                      value={pendingCoach[c.id] || ""}
                      onChange={(e) =>
                        setPendingCoach((p) => ({
                          ...p,
                          [c.id]: e.target.value,
                        }))
                      }
                      style={{ width: "auto", minWidth: "150px" }}
                    >
                      <option value="">Choose coach…</option>
                      {coachOptions()}
                    </select>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!pendingCoach[c.id] || busyId === c.id}
                      onClick={() => reassign(c, pendingCoach[c.id])}
                    >
                      {busyId === c.id ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {myRole === "admin" && (
        <>
          <SectionTitle>
            COACHES &amp; ADMINS (
            {people.filter((p) => p.role !== "member" && !isInactive(p)).length}
            )
          </SectionTitle>
          <div className="mb-4">
            {people
              .filter((p) => p.role !== "member" && !isInactive(p))
              .map((p) => {
                const n = activeClients.filter(
                  (c) => c.coachId === p.id,
                ).length;
                return (
                  <div
                    key={p.id}
                    className="card mb-2"
                    style={{ padding: "10px 16px" }}
                  >
                    <div className="flex-between">
                      <div>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span
                          className="muted small"
                          style={{ marginLeft: "8px" }}
                        >
                          {p.email}
                        </span>
                        <div className="muted small">
                          {n} client{n !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div
                        className="flex gap-2"
                        style={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <span className="role-badge">{roleLabel(p.role)}</span>
                        {p.role === "coach" &&
                          deactivateControls(
                            p,
                            n > 0
                              ? `${n} client${n !== 1 ? "s" : ""} will need a new coach.`
                              : "",
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}

      <SectionTitle>
        CLIENTS (
        {myRole === "admin"
          ? activeClients.length - orphaned.length
          : activeClients.length}
        )
      </SectionTitle>
      {activeClients.length - orphaned.length === 0 ? (
        <p className="muted small mb-4">
          No clients yet. Create an invite above and share the link.
        </p>
      ) : (
        <div className="mb-4">
          {activeClients
            .filter((c) => myRole !== "admin" || coachOk(c.coachId))
            .map((c) => (
              <div
                key={c.id}
                className="card mb-2"
                style={{ padding: "10px 16px" }}
              >
                <div className="flex-between">
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span className="muted small" style={{ marginLeft: "8px" }}>
                      {c.email}
                    </span>
                    {myRole !== "admin" && (
                      <div className="muted small">
                        Coach: {nameOf(c.coachId)}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex gap-2"
                    style={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    {myRole === "admin" && (
                      <>
                        <select
                          aria-label={`Coach for ${c.name}`}
                          value={pendingCoach[c.id] ?? c.coachId}
                          onChange={(e) =>
                            setPendingCoach((p) => ({
                              ...p,
                              [c.id]: e.target.value,
                            }))
                          }
                          style={{ width: "auto", minWidth: "140px" }}
                        >
                          {coachOptions()}
                        </select>
                        {pendingCoach[c.id] &&
                          pendingCoach[c.id] !== c.coachId && (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={busyId === c.id}
                              onClick={() => reassign(c, pendingCoach[c.id])}
                            >
                              {busyId === c.id ? "Moving…" : "Save"}
                            </button>
                          )}
                      </>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setOpenClientId(c.id)}
                    >
                      Open plan →
                    </button>
                    {myRole === "admin" && deactivateControls(c, "")}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {myRole === "admin" && inactivePeople.length > 0 && (
        <>
          <div className="flex-between mb-3">
            <h4
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: "1rem",
                letterSpacing: "0.08em",
                color: "#8a7a6a",
              }}
            >
              INACTIVE ({inactivePeople.length})
            </h4>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInactive((o) => !o)}
            >
              {showInactive ? "Hide" : "Show"}
            </button>
          </div>
          {showInactive &&
            inactivePeople.map((p) => (
              <div
                key={p.id}
                className="card mb-2"
                style={{ padding: "10px 16px", opacity: 0.85 }}
              >
                <div className="flex-between">
                  <div>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span className="muted small" style={{ marginLeft: "8px" }}>
                      {p.email}
                    </span>
                    <div className="muted small">
                      {roleLabel(p.role)} · deactivated {fmt(p.statusChangedAt)}
                      . Sessions and results are kept.
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busyId === p.id}
                    onClick={() => setActive(p, true)}
                  >
                    Reactivate
                  </button>
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
