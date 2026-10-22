import { useState, useEffect } from "react";
import "./styles.css";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import { roleLabel, readInviteParam } from "./lib/invites";
import { migrateLegacyResults } from "./lib/legacyMigration";
import { useAuthProfile } from "./hooks/useAuthProfile";
import { usePlanning } from "./hooks/usePlanning";
import { GrainBg } from "./components/GrainBg";
import { ErrorBanner } from "./components/ErrorBanner";
import { NoAccess } from "./components/NoAccess";
import { AccountNotice } from "./components/AccountNotice";
import { DeactivatedNotice } from "./components/DeactivatedNotice";
import { LoginView } from "./views/LoginView";
import { RegisterView } from "./views/RegisterView";
import { ClientsView } from "./views/ClientsView";
import { MyPlanView } from "./views/MyPlanView";
import { MemberView } from "./views/MemberView";
import { AdminView } from "./views/admin/AdminView";

export default function App() {
  const [view, setView] = useState(() =>
    readInviteParam() ? "register" : "member",
  );
  const [inviteCode, setInviteCode] = useState(() => readInviteParam());
  const {
    registeringRef,
    authReady,
    authUser,
    profile,
    org,
    profileError,
    profileLoading,
    setProfileLoading,
    loadProfile,
  } = useAuthProfile();

  const finishRegistration = async () => {
    registeringRef.current = false;
    setProfileLoading(true);
    await loadProfile(auth.currentUser);
    setProfileLoading(false);
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch {
      // only tidies the ?invite= from the address bar; harmless if the browser refuses
    }
    setInviteCode("");
    setView("login"); // derived routing sends the new user to their role's home
  };

  const role = profile ? profile.role : null;
  const homeFor = (r) =>
    r === "admin"
      ? "classes"
      : r === "coach"
        ? "clients"
        : r === "member"
          ? "myplan"
          : "member";
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out failed:", err);
    }
    setView("member");
  };
  const isAdminUser =
    role === "admin" && !(profile && profile.active === false);
  const [migration, setMigration] = useState(null); // {status: "running" | "done" | "error", count}
  const {
    periods,
    activePeriodId,
    setActivePeriodId,
    memberRoster,
    planningStatus,
    loaded,
    saveFailed,
    activePeriod,
    allWorkouts,
    editMemberRoster,
    setSessionMembersForWod,
    getSessionMembers,
    updatePeriod,
    addPeriod,
    deletePeriod,
    addWorkout,
    updateWorkout,
    deleteWorkout,
  } = usePlanning(isAdminUser);

  // One-time move of the old results blobs into per-session documents (runs for an admin only)
  useEffect(() => {
    if (!loaded || !isAdminUser) return;
    let cancelled = false;
    (async () => {
      try {
        const validIds = new Set(
          periods.flatMap((p) => p.workouts.map((w) => String(w.id))),
        );
        const r = await migrateLegacyResults(validIds, () => {
          if (!cancelled) setMigration({ status: "running" });
        });
        if (!cancelled && !r.skipped)
          setMigration({ status: "done", count: r.count });
      } catch {
        if (!cancelled) setMigration({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, isAdminUser]);
  useEffect(() => {
    if (migration?.status !== "done") return;
    const t = setTimeout(() => setMigration(null), 10000);
    return () => clearTimeout(t);
  }, [migration]);

  if (planningStatus === "loading" || !authReady)
    return (
      <div
        style={{
          color: "#FF6B1A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        Loading…
      </div>
    );

  // Which screen is actually shown (derived, so the nav highlight always matches)
  const PROTECTED = ["classes", "clients", "myplan"];
  const deactivated = !!profile && profile.active === false;
  let current = view;
  if (
    authUser &&
    profileLoading &&
    (view === "login" || PROTECTED.includes(view))
  )
    current = "loading";
  else if (view === "login" && authUser)
    current = profile
      ? deactivated
        ? "deactivated"
        : homeFor(role)
      : "account";
  if (PROTECTED.includes(current) && authUser && profile === false)
    current = "account";
  if (PROTECTED.includes(current) && authUser && deactivated)
    current = "deactivated";
  if (PROTECTED.includes(current) && !authUser) current = "login";

  const tabs = [{ id: "member", label: "Home" }];
  if (!deactivated) {
    if (role === "admin")
      tabs.push(
        { id: "classes", label: "Classes" },
        { id: "clients", label: "Clients" },
      );
    else if (role === "coach") tabs.push({ id: "clients", label: "Clients" });
    else if (role === "member") tabs.push({ id: "myplan", label: "My Plan" });
  }

  const noAccess = <NoAccess />;

  return (
    <>
      <div className="app-root">
        <GrainBg />
        <nav className="nav">
          <div className="nav-logo">⚡ RIGG WORKOUT</div>
          <div className="nav-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`nav-tab ${current === t.id ? "active" : ""}`}
                onClick={() => setView(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="nav-account">
            {authUser ? (
              <>
                <span className="nav-user">
                  {profile?.name || authUser.email}
                </span>
                {role && (
                  <span className="role-badge">
                    {deactivated ? "inactive" : roleLabel(role)}
                  </span>
                )}
                <button className="nav-tab" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <button
                className={`nav-tab ${current === "login" ? "active" : ""}`}
                onClick={() => setView("login")}
              >
                Log in
              </button>
            )}
          </div>
        </nav>

        {migration && isAdminUser && (
          <div
            className="page"
            style={{
              position: "relative",
              zIndex: 1,
              paddingTop: "12px",
              paddingBottom: 0,
              maxWidth: "900px",
            }}
          >
            <div
              className="card"
              style={{
                padding: "10px 16px",
                fontSize: "0.85rem",
                color: migration.status === "error" ? "#ff7070" : "#c8bfb0",
              }}
            >
              {migration.status === "running" &&
                "Moving class results to the new storage… keep this page open for a moment."}
              {migration.status === "done" &&
                `Class results moved to the new storage (${migration.count} session${migration.count !== 1 ? "s" : ""}).`}
              {migration.status === "error" &&
                "Moving the class results didn't finish. Reload the page to try again. Nothing is lost."}
            </div>
          </div>
        )}

        {current === "member" &&
          (planningStatus === "error" ? (
            <ErrorBanner>
              Could not load the workouts. Check your connection and reload the
              page.
            </ErrorBanner>
          ) : (
            <MemberView
              allWorkouts={allWorkouts}
              periods={periods}
              getSessionMembers={getSessionMembers}
              memberRoster={memberRoster}
            />
          ))}
        {current === "classes" && role === "admin" && (
          <>
            {planningStatus === "error" && (
              <ErrorBanner>
                Could not load the planning. Editing is paused so nothing gets
                overwritten. Reload the page.
              </ErrorBanner>
            )}
            {saveFailed && (
              <ErrorBanner>
                Your last change could not be saved. Reload before editing
                more.
              </ErrorBanner>
            )}
          </>
        )}
        {current === "loading" && (
          <div
            className="page text-center muted"
            style={{ position: "relative", zIndex: 1 }}
          >
            Loading your account…
          </div>
        )}
        {current === "login" && (
          <LoginView onRegister={() => setView("register")} />
        )}
        {current === "register" && (
          <RegisterView
            initialCode={inviteCode}
            authUser={authUser}
            onLogout={async () => {
              try {
                await signOut(auth);
              } catch (err) {
                console.warn("Sign out failed:", err);
              }
            }}
            onBegin={() => {
              registeringRef.current = true;
            }}
            onAbort={() => {
              registeringRef.current = false;
            }}
            onDone={finishRegistration}
            onBackToLogin={() => setView("login")}
          />
        )}
        {current === "account" && (
          <AccountNotice
            email={authUser?.email}
            error={profileError}
            onLogout={logout}
          />
        )}
        {current === "deactivated" && (
          <DeactivatedNotice email={authUser?.email} onLogout={logout} />
        )}
        {current === "classes" &&
          (role !== "admin" ? (
            noAccess
          ) : planningStatus === "error" ? null : (
            <AdminView
              periods={periods}
              activePeriod={activePeriod}
              activePeriodId={activePeriodId}
              setActivePeriodId={setActivePeriodId}
              updatePeriod={updatePeriod}
              addPeriod={addPeriod}
              deletePeriod={deletePeriod}
              addWorkout={addWorkout}
              updateWorkout={updateWorkout}
              deleteWorkout={deleteWorkout}
              setSessionMembersForWod={setSessionMembersForWod}
              getSessionMembers={getSessionMembers}
              memberRoster={memberRoster}
              editMemberRoster={editMemberRoster}
              orgId={profile.orgId}
              profile={profile}
              authUser={authUser}
            />
          ))}
        {current === "clients" &&
          (role === "admin" || role === "coach" ? (
            <ClientsView profile={profile} authUser={authUser} org={org} />
          ) : (
            noAccess
          ))}
        {current === "myplan" &&
          (role === "member" ? (
            <MyPlanView profile={profile} authUser={authUser} org={org} />
          ) : (
            noAccess
          ))}
      </div>
    </>
  );
}

