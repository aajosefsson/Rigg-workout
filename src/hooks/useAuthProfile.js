import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";

// Firebase sign-in state plus the signed-in user's profile and organization
export function useAuthProfile() {
  const registeringRef = useRef(false);

  // ── Real authentication + roles ────────────────────────────────────────────
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null); // {role, orgId, name, email, ...}; false = signed in but no profile found
  const [org, setOrg] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = async (u) => {
    try {
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const p = snap.data();
        setProfile(p);
        try {
          const o = await getDoc(doc(db, "orgs", p.orgId));
          setOrg(o.exists() ? o.data() : null);
        } catch {
          setOrg(null);
        }
      } else {
        setProfile(false);
        setOrg(null);
      }
    } catch {
      setProfile(false);
      setOrg(null);
      setProfileError(
        "Could not load your profile. Check your connection and the Firestore rules.",
      );
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthUser(u);
      setProfileError("");
      if (!u) {
        setProfile(null);
        setOrg(null);
        setProfileLoading(false);
        setAuthReady(true);
        return;
      }
      if (registeringRef.current) {
        setAuthReady(true);
        return;
      } // the register screen loads the profile itself when done
      setProfileLoading(true);
      await loadProfile(u);
      setProfileLoading(false);
      setAuthReady(true);
    });
    return unsub;
  }, []);
  return {
    registeringRef,
    authReady,
    authUser,
    profile,
    org,
    profileError,
    profileLoading,
    setProfileLoading,
    loadProfile,
  };
}
