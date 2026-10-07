import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";

const load = async (key, fallback = null) => {
  try {
    const snap = await getDoc(doc(db, "riggworkout", key));
    return snap.exists() ? snap.data().value : fallback;
  } catch {
    return fallback;
  }
};
const save = async (key, val) => {
  try {
    await setDoc(doc(db, "riggworkout", key), { value: val });
  } catch {}
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const BLOCK_COLORS = { A: "#FF6B1A", B: "#FF9A4D", C: "#FFB87A", D: "#FFCFA0" };
const RESULT_VARS = [
  "Time",
  "Rounds",
  "Reps",
  "Weight (kg)",
  "Distance (m)",
  "Comment",
];
const BLOCK_TEMPLATES = {
  "For Time": {
    description: "For Time:\n21-15-9\n[Movement 1]\n[Movement 2]",
    variables: ["Time", "Comment"],
  },
  AMRAP: {
    description:
      "AMRAP 12:\n[Movement 1] x10\n[Movement 2] x10\n[Movement 3] x10",
    variables: ["Rounds", "Reps", "Comment"],
  },
  EMOM: {
    description: "EMOM 10:\nOdd minutes: [Movement]\nEven minutes: [Movement]",
    variables: ["Reps", "Weight (kg)", "Comment"],
  },
  Strength: {
    description: "[Exercise]\n5 sets x 5 reps\nRest 2-3 min between sets",
    variables: ["Weight (kg)", "Reps", "Comment"],
    sets: 5,
  },
};
// A template always sets the block's number of sets too (1 = log everything once)
const templatePatch = (name) => ({
  description: BLOCK_TEMPLATES[name].description,
  variables: BLOCK_TEMPLATES[name].variables,
  sets: BLOCK_TEMPLATES[name].sets || 1,
});
const EMPTY_BLOCK = () => ({
  name: "A",
  description: "",
  variables: ["Rounds", "Weight (kg)"],
});
const EMPTY_WOD = () => ({
  id: Date.now(),
  title: "",
  sessionNumber: 1,
  blocks: [EMPTY_BLOCK()],
  date: todayStr(),
});
const EMPTY_PERIOD = () => ({
  id: Date.now(),
  name: "",
  focus: "",
  startDate: todayStr(),
  durationWeeks: 8,
  workouts: [],
});
const DEFAULT_MEMBERS = [
  "Erik",
  "Sofia",
  "Marcus",
  "Linnea",
  "Johan",
  "Emma",
  "Andreas",
  "Maja",
  "David",
  "Sara",
  "Tobias",
  "Klara",
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDate(str) {
  if (!str) return "";
  const d = new Date(str + "T12:00:00");
  return `${DAYS[d.getDay() == 0 ? 6 : d.getDay() - 1]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekDates(mondayStr) {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

const GrainBg = () => (
  <svg
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 0,
      opacity: 0.35,
    }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <filter id="grain">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves="3"
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: 'Barlow', sans-serif; background: #0f0a06; color: #f0ebe3; min-height: 100vh; }
  .app-root {
    position: relative; min-height: 100vh;
    background: radial-gradient(ellipse 80% 60% at 20% 10%, #4a1800 0%, transparent 55%),
                radial-gradient(ellipse 60% 50% at 80% 80%, #2d0f00 0%, transparent 50%),
                radial-gradient(ellipse 100% 80% at 50% 50%, #1a0800 0%, #0f0a06 100%);
  }
  h1,h2,h3,h4,h5 { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 0.02em; }
  .orange { color: #FF6B1A; } .muted { color: #8a7a6a; } .small { font-size:0.8rem; }

  .nav {
    position: sticky; top:0; z-index:100;
    display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 12px;
    padding: 14px 24px;
    background: rgba(15,10,6,0.88); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,107,26,0.15);
  }
  .nav-logo { font-family:'Barlow Condensed',sans-serif; font-size:1.5rem; font-weight:800; letter-spacing:0.08em; color:#FF6B1A; white-space:nowrap; }
  .nav-tabs { display:flex; gap:4px; flex-shrink:0; }
  .nav-tab {
    padding: 7px 18px; border-radius:6px; border:none; cursor:pointer;
    font-family:'Barlow',sans-serif; font-size:0.85rem; font-weight:600;
    background: transparent; color: #8a7a6a; transition: all 0.2s; white-space:nowrap;
  }
  .nav-account { display:flex; align-items:center; gap:8px; }
  .nav-user { font-size:0.78rem; color:#8a7a6a; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; }
  .role-badge { display:inline-flex; padding:2px 9px; border-radius:20px; background:rgba(255,107,26,0.12); color:#FF6B1A; font-size:0.7rem; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; }
  .nav-tab.active { background: rgba(255,107,26,0.15); color:#FF6B1A; }
  .nav-tab:hover:not(.active) { color:#f0ebe3; background:rgba(255,255,255,0.05); }

  .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px; backdrop-filter: blur(4px); }
  .card-orange { border-color: rgba(255,107,26,0.3); background: rgba(255,107,26,0.06); }

  input, textarea, select {
    width:100%; padding:9px 12px; border-radius:7px;
    border:1px solid rgba(255,255,255,0.12);
    background:rgba(255,255,255,0.06); color:#f0ebe3;
    font-family:'Barlow',sans-serif; font-size:0.9rem; transition: border 0.2s; outline:none;
  }
  input:focus, textarea:focus, select:focus { border-color:rgba(255,107,26,0.5); }
  textarea { resize:vertical; min-height:80px; }
  select option { background:#1a1008; }
  label { font-size:0.78rem; font-weight:600; color:#8a7a6a; text-transform:uppercase; letter-spacing:0.06em; display:block; margin-bottom:5px; }

  .btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:9px 18px; border-radius:7px; border:none; cursor:pointer;
    font-family:'Barlow',sans-serif; font-size:0.875rem; font-weight:600;
    transition: all 0.18s; text-decoration:none;
  }
  .btn-primary { background:#FF6B1A; color:#fff; }
  .btn-primary:hover { background:#e55c0e; transform:translateY(-1px); }
  .btn-ghost { background:rgba(255,255,255,0.07); color:#f0ebe3; }
  .btn-ghost:hover { background:rgba(255,255,255,0.12); }
  .btn-danger { background:rgba(220,50,50,0.15); color:#ff7070; border:1px solid rgba(220,50,50,0.2); }
  .btn-danger:hover { background:rgba(220,50,50,0.25); }
  .btn-sm { padding:5px 12px; font-size:0.8rem; }
  .btn-xs { padding:3px 9px; font-size:0.75rem; border-radius:5px; }

  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
  .flex { display:flex; } .flex-center { display:flex; align-items:center; }
  .flex-between { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .flex-wrap { flex-wrap:wrap; }
  .gap-2{gap:8px;} .gap-3{gap:12px;} .gap-4{gap:16px;}
  .col{flex-direction:column;}
  .mt-1{margin-top:4px;} .mt-2{margin-top:8px;} .mt-3{margin-top:12px;} .mt-4{margin-top:16px;} .mt-6{margin-top:24px;}
  .mb-2{margin-bottom:8px;} .mb-3{margin-bottom:12px;} .mb-4{margin-bottom:16px;} .mb-6{margin-bottom:24px;}
  .w-full{width:100%;} .text-center{text-align:center;}

  .block-badge {
    display:inline-flex; align-items:center; justify-content:center;
    width:28px; height:28px; border-radius:6px;
    font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:1rem; flex-shrink:0;
  }
  .session-tag {
    display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px;
    background:rgba(255,107,26,0.12); color:#FF6B1A; font-size:0.78rem; font-weight:600; letter-spacing:0.04em;
  }

  .results-table { width:100%; border-collapse:collapse; }
  .results-table th { padding:8px 10px; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#8a7a6a; border-bottom:1px solid rgba(255,255,255,0.08); }
  .results-table td { padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.04); }
  .results-table tr:hover td { background:rgba(255,255,255,0.02); }
  .results-table input { padding:5px 8px; font-size:0.85rem; }

  .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
  .cal-day { aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:6px; cursor:pointer; font-size:0.78rem; font-weight:600; transition:all 0.15s; }
  .cal-day:hover { background:rgba(255,255,255,0.07); }
  .cal-day.has-wod { background:rgba(255,107,26,0.12); color:#FF6B1A; }
  .cal-day.is-today { background:rgba(255,107,26,0.25); color:#FF6B1A; font-weight:800; }
  .cal-day.is-selected { outline:2px solid #FF6B1A; }
  .cal-day.other-month { opacity:0.3; }
  .cal-dot { width:4px; height:4px; border-radius:50%; background:#FF6B1A; margin-top:2px; }

  .wod-nav-btn { padding:8px 14px; border-radius:8px; border:none; cursor:pointer; background:rgba(255,255,255,0.07); color:#f0ebe3; font-size:1rem; transition:all 0.15s; flex-shrink:0; }
  .wod-nav-btn:hover:not(:disabled) { background:rgba(255,107,26,0.2); color:#FF6B1A; }
  .wod-nav-btn:disabled { opacity:0.25; cursor:default; }

  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .login-card { width:100%; max-width:380px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,107,26,0.2); border-radius:16px; padding:40px 32px; backdrop-filter:blur(8px); }

  .member-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); font-size:0.82rem; cursor:pointer; transition:all 0.15s; }
  .member-pill.active { background:rgba(255,107,26,0.15); border-color:rgba(255,107,26,0.35); color:#FF6B1A; }
  .member-pill:hover:not(.active):not(:disabled) { border-color:rgba(255,255,255,0.2); }

  .page { max-width:1100px; margin:0 auto; padding:24px 20px 60px; position:relative; z-index:1; }
  .section-header { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
  .section-line { flex:1; height:1px; background:rgba(255,255,255,0.07); }
  .period-list { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
  .period-pill { padding:6px 14px; border-radius:20px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#8a7a6a; font-size:0.82rem; font-weight:600; cursor:pointer; transition:all 0.15s; }
  .period-pill.active { background:rgba(255,107,26,0.15); border-color:rgba(255,107,26,0.3); color:#FF6B1A; }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,107,26,0.3); border-radius:3px; }
  .check-var { display:flex; align-items:center; gap:7px; cursor:pointer; font-size:0.83rem; padding:4px 0; }
  .check-var input[type=checkbox] { width:auto; cursor:pointer; accent-color:#FF6B1A; }
  .week-day-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:14px; min-height:120px; cursor:pointer; transition:all 0.15s; }
  .week-day-card:hover { border-color:rgba(255,107,26,0.25); background:rgba(255,107,26,0.04); }
  .week-day-card.today-card { border-color:rgba(255,107,26,0.4); background:rgba(255,107,26,0.08); }
  .week-day-card.has-wod-card { border-color:rgba(255,107,26,0.2); }
  .admin-tabs { display:flex; border-bottom:1px solid rgba(255,255,255,0.07); margin-bottom:24px; flex-wrap:wrap; }
  .admin-tab { padding:10px 20px; border:none; background:transparent; color:#8a7a6a; font-family:'Barlow',sans-serif; font-size:0.87rem; font-weight:600; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s; }
  .admin-tab.active { color:#FF6B1A; border-bottom-color:#FF6B1A; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
  .modal-inner { background:#1a0f07; border:1px solid rgba(255,107,26,0.3); border-radius:14px; width:100%; max-width:620px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; }
  .modal-header { flex-shrink:0; padding:20px 28px 16px; border-bottom:1px solid rgba(255,255,255,0.08); }
  .modal-body { flex:1; overflow-y:auto; padding:18px 28px 28px; }
  @media(max-width:640px){
    .grid-2,.grid-3 { grid-template-columns:1fr; }
    .admin-tab { padding:8px 12px; font-size:0.8rem; }
  }
  @media(max-width:560px){
    .nav { padding:10px 14px; }
    .nav-logo { font-size:1.1rem; }
    .nav-tabs { order:3; width:100%; justify-content:center; gap:4px; }
    .nav-tab { padding:7px 14px; font-size:0.8rem; }
    .nav-user { display:none; }
  }
`;

const DEMO_PERIOD = {
  id: 1700000000000,
  name: "Spring Strength Block",
  focus: "Back Squat & Gymnastics",
  startDate: todayStr(),
  durationWeeks: 8,
  workouts: [
    {
      id: 1700000001000,
      title: "Heavy Squats + MetCon",
      sessionNumber: 1,
      date: todayStr(),
      blocks: [
        {
          name: "A",
          description: "Back Squat\n5x5 @ 80%\nRest 3 min between sets",
          variables: ["Weight (kg)", "Comment"],
        },
        {
          name: "B",
          description: "For Time:\n21-15-9\nThrusters (42.5/30kg)\nPull-ups",
          variables: ["Time", "Comment"],
        },
      ],
    },
  ],
};

// ─── Invite helpers ────────────────────────────────────────────────────────────
const roleLabel = (r) => (r === "member" ? "client" : r);
const readInviteParam = () => {
  try {
    return new URLSearchParams(window.location.search).get("invite") || "";
  } catch {
    return "";
  }
};
const normCode = (c) => (c || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const makeCode = () => {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // 32 symbols, no look-alikes (l, o, 0, 1)
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
};
const prettyCode = (c) => (c.match(/.{1,5}/g) || []).join("-");
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// Opens the coach's own mail app with the invitation already written (sent from their address)
const inviteMailto = ({
  email,
  firstName,
  orgName,
  inviterName,
  role,
  link,
}) => {
  const subject = `Din inbjudan till ${orgName}`;
  const body =
    `Hej ${firstName || ""}!\n\n${inviterName} har bjudit in dig till ${orgName} som ${role === "member" ? "klient" : "coach"}.\n\n` +
    `Skapa ditt konto här (länken gäller i 7 dagar och kan bara användas en gång):\n${link}\n\n` +
    `Du väljer ett eget lösenord när du registrerar dig. Använd samma e-postadress som det här mejlet skickades till.\n\nVälkommen!\n${inviterName}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// ─── Detailed result fields ────────────────────────────────────────────────────
// Some fields are asked once per block ("Rounds", "Comment"). Weight, reps, time and distance
// can be asked per SET (block.sets > 1), per EXERCISE (block.exercises = ["Squat", ...]), or both.
// Stored under keys like "Weight (kg)", "Weight (kg)#2" (set 2), "Weight (kg)@3" (exercise 3)
// and "Weight (kg)#2@3" (set 2 of exercise 3).
const PER_SET_ORDER = ["Weight (kg)", "Reps", "Time", "Distance (m)"];
const SET_SHORT = {
  "Weight (kg)": "kg",
  Reps: "reps",
  Time: "time",
  "Distance (m)": "m",
};
const blockSets = (block) =>
  Math.max(1, Math.min(10, Number(block?.sets) || 1));
const exercisesOf = (block) =>
  Array.isArray(block?.exercises)
    ? block.exercises
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter(Boolean)
    : [];
const isDetailed = (block) =>
  blockSets(block) > 1 || exercisesOf(block).length > 0;
const perSetVarsOf = (block) =>
  isDetailed(block)
    ? PER_SET_ORDER.filter((v) => (block.variables || []).includes(v))
    : [];
const singleVarsOf = (block) =>
  (block.variables || []).filter((v) => !perSetVarsOf(block).includes(v));
const entryKey = (v, setNo, exNo) =>
  `${v}${setNo ? `#${setNo}` : ""}${exNo ? `@${exNo}` : ""}`;
const shortName = (v) => v.replace(/ \(.*\)/, "").toLowerCase();
const setNumbers = (block) =>
  blockSets(block) > 1
    ? Array.from({ length: blockSets(block) }, (_, i) => i + 1)
    : [0];
const exerciseGroups = (block) => {
  const ex = exercisesOf(block);
  return ex.length
    ? ex.map((name, i) => ({ name, no: i + 1 }))
    : [{ name: "", no: 0 }];
};
const cleanBlock = (b) => ({ ...b, exercises: exercisesOf(b) }); // run when a session is saved: no empty names

// Every input a member fills in for a block, in order, with a readable label
const fieldList = (block) => {
  const per = perSetVarsOf(block),
    out = [];
  if (per.length)
    exerciseGroups(block).forEach((g) =>
      setNumbers(block).forEach((sn) =>
        per.forEach((v) =>
          out.push({
            key: entryKey(v, sn, g.no),
            label: [g.name, sn ? `Set ${sn}` : "", v]
              .filter(Boolean)
              .join(" · "),
          }),
        ),
      ),
    );
  singleVarsOf(block).forEach((v) => out.push({ key: v, label: v }));
  return out;
};
const fieldKeys = (block) => fieldList(block).map((f) => f.key);

// "90 kg · 5 reps" for one set of one exercise
const formatCell = (per, setNo, exNo, get) => {
  const parts = [];
  per.forEach((v) => {
    const val = String(get(entryKey(v, setNo, exNo)) || "").trim();
    if (!val) return;
    parts.push(
      v === "Weight (kg)"
        ? `${val} kg`
        : v === "Reps"
          ? `${val} reps`
          : v === "Distance (m)"
            ? `${val} m`
            : val,
    );
  });
  return parts.join(" · ");
};

// Columns for a read-only results table
const resultColumns = (block) => {
  const per = perSetVarsOf(block),
    exs = exercisesOf(block),
    cols = [];
  if (per.length && exs.length) {
    exs.forEach((name, i) =>
      cols.push({
        label: name,
        cell: (get) =>
          setNumbers(block)
            .map((sn) => {
              const t = formatCell(per, sn, i + 1, get);
              return t ? (sn ? `S${sn}: ${t}` : t) : "";
            })
            .filter(Boolean)
            .join("\n"),
      }),
    );
  } else if (per.length) {
    setNumbers(block).forEach((sn) =>
      cols.push({
        label: `Set ${sn}`,
        cell: (get) => formatCell(per, sn, 0, get),
      }),
    );
  }
  if (per.length)
    singleVarsOf(block).forEach((v) =>
      cols.push({ label: v, cell: (get) => get(v) }),
    );
  else
    (block.variables || []).forEach((v) =>
      cols.push({ label: v, cell: (get) => get(v) }),
    );
  return cols;
};

// Values that were logged under a different setup than the block has now (so nothing is ever hidden)
const orphanEntries = (block, all) => {
  const known = new Set(fieldKeys(block));
  return Object.entries(all || {}).filter(
    ([k, v]) => !known.has(k) && String(v ?? "").trim(),
  );
};

// One line of text for the coach, e.g. "Squat: S1 90 kg · 5 reps / S2 100 kg · 5 reps · Comment: heavy"
const describeResults = (block, get, all) => {
  const per = perSetVarsOf(block),
    exs = exercisesOf(block),
    out = [];
  if (per.length && exs.length) {
    exs.forEach((name, i) => {
      const t = setNumbers(block)
        .map((sn) => {
          const c = formatCell(per, sn, i + 1, get);
          return c ? (sn ? `S${sn} ${c}` : c) : "";
        })
        .filter(Boolean)
        .join(" / ");
      if (t) out.push(`${name}: ${t}`);
    });
  } else if (per.length) {
    setNumbers(block).forEach((sn) => {
      const t = formatCell(per, sn, 0, get);
      if (t) out.push(`Set ${sn}: ${t}`);
    });
  }
  singleVarsOf(block).forEach((v) => {
    const t = String(get(v) || "").trim();
    if (t) out.push(`${v}: ${t}`);
  });
  const other = orphanEntries(block, all);
  if (other.length)
    out.push(
      `Logged under an earlier setup: ${other.map(([k, v]) => `${k} ${v}`).join(", ")}`,
    );
  return out.join(" · ");
};

// What the coach is asking members to fill in, in plain words
const describeFields = (block) => {
  const per = perSetVarsOf(block),
    singles = singleVarsOf(block),
    exs = exercisesOf(block),
    sets = blockSets(block),
    parts = [];
  if (per.length) {
    const what = per.map(shortName).join(" and ");
    parts.push(
      exs.length
        ? `${what} for each of ${exs.length} exercise${exs.length !== 1 ? "s" : ""}${sets > 1 ? `, ${sets} sets each` : ""}`
        : `${what} for each of ${sets} sets`,
    );
  }
  if (singles.length) parts.push(`${singles.map(shortName).join(", ")} once`);
  return parts.length
    ? `Members log: ${parts.join(", then ")}.`
    : "No result fields chosen. Members just mark the block as done.";
};

// Coach side: which fields to ask for, per set and/or per exercise
function ResultFieldsEditor({ block, onChange, hasResults }) {
  const vars = block.variables || [];
  const sets = blockSets(block);
  const exercises = Array.isArray(block.exercises) ? block.exercises : [];
  const canDetail = PER_SET_ORDER.some((v) => vars.includes(v));
  const toggle = (v) =>
    onChange({
      variables: vars.includes(v) ? vars.filter((x) => x !== v) : [...vars, v],
    });
  const hasNumbered = /^\s*\d+\s*[.)]\s*\S/m.test(block.description || "");
  const fromDescription = () => {
    const names = String(block.description || "")
      .split("\n")
      .map((l) => l.trim().match(/^\d+\s*[.)]\s*(.+)$/))
      .filter(Boolean)
      .map((m) => m[1].replace(/^\d+\s*(reps?|x)\s+/i, "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (names.length) onChange({ exercises: names });
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {RESULT_VARS.map((v) => (
          <label key={v} className="check-var">
            <input
              type="checkbox"
              checked={vars.includes(v)}
              onChange={() => toggle(v)}
            />
            {v}
          </label>
        ))}
      </div>
      {canDetail && (
        <>
          <div
            className="flex gap-2 mt-2"
            style={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <span className="muted small">Log per set:</span>
            <select
              aria-label="Log per set"
              value={sets}
              onChange={(e) => onChange({ sets: Number(e.target.value) })}
              style={{ width: "auto", padding: "4px 8px" }}
            >
              <option value={1}>Off</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} sets
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <div className="muted small" style={{ marginBottom: "6px" }}>
              Log each exercise separately (optional):
            </div>
            {exercises.map((name, i) => (
              <div
                key={i}
                className="flex gap-2 mb-2"
                style={{ alignItems: "center" }}
              >
                <span
                  className="muted small"
                  style={{ width: "18px", flexShrink: 0 }}
                >
                  {i + 1}.
                </span>
                <input
                  aria-label={`Exercise ${i + 1}`}
                  value={name}
                  placeholder="Exercise name"
                  onChange={(e) =>
                    onChange({
                      exercises: exercises.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn btn-danger btn-xs"
                  aria-label={`Remove exercise ${i + 1}`}
                  onClick={() =>
                    onChange({ exercises: exercises.filter((_, j) => j !== i) })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
              {exercises.length < 6 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => onChange({ exercises: [...exercises, ""] })}
                >
                  + Add exercise
                </button>
              )}
              {hasNumbered && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={fromDescription}
                >
                  Use the numbered lines above
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <p className="muted small mt-2">{describeFields(block)}</p>
      {hasResults && (
        <p className="small mt-2" style={{ color: "#ff9c9c" }}>
          Results are already logged for this block. Changing the setup won't
          delete them, but they'll show as "earlier setup".
        </p>
      )}
    </div>
  );
}

// Member side: the input fields for one block (per exercise and/or a row per set, as the coach asked for)
function ResultInputs({ block, getValue, setValue, idPrefix }) {
  const sets = blockSets(block);
  const per = perSetVarsOf(block);
  const singles = singleVarsOf(block);
  const groups = exerciseGroups(block);
  const setNos = setNumbers(block);
  const id = (k) => `${idPrefix}_${k.replace(/\W+/g, "_")}`;
  const cols = `${sets > 1 ? "46px " : ""}repeat(${per.length}, minmax(0, 1fr))${sets > 1 ? " auto" : ""}`;
  const headStyle = {
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };
  // number keypad on phones for the one-value-per-box fields (time needs ":" so it keeps the normal keyboard)
  const keypad = {
    "Weight (kg)": "decimal",
    "Distance (m)": "decimal",
    Reps: "numeric",
  };
  const copyPrev = (exNo, sn) =>
    per.forEach((v) =>
      setValue(entryKey(v, sn, exNo), getValue(entryKey(v, sn - 1, exNo))),
    );
  return (
    <>
      {per.length > 0 &&
        groups.map((g) => (
          <div key={g.no} style={{ marginBottom: "16px" }}>
            {g.name && (
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.92rem",
                  marginBottom: "8px",
                }}
              >
                {g.name}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              {sets > 1 && <span />}
              {per.map((v) => (
                <span key={v} className="muted" style={headStyle}>
                  {v}
                </span>
              ))}
              {sets > 1 && <span />}
            </div>
            {setNos.map((sn) => (
              <div
                key={sn}
                style={{
                  display: "grid",
                  gridTemplateColumns: cols,
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                {sets > 1 && (
                  <span className="muted small" style={{ fontWeight: 700 }}>
                    Set {sn}
                  </span>
                )}
                {per.map((v) => {
                  const k = entryKey(v, sn, g.no);
                  return (
                    <input
                      key={v}
                      id={id(k)}
                      style={{ padding: "8px" }}
                      value={getValue(k)}
                      placeholder={SET_SHORT[v]}
                      inputMode={keypad[v]}
                      autoComplete="off"
                      aria-label={`${g.name ? g.name + ", " : ""}${v}${sn ? `, set ${sn}` : ""}`}
                      onChange={(e) => setValue(k, e.target.value)}
                    />
                  );
                })}
                {sets > 1 &&
                  (sn > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{ padding: "6px 8px", whiteSpace: "nowrap" }}
                      title={`Same as set ${sn - 1}`}
                      aria-label={`Copy set ${sn - 1} to set ${sn}${g.name ? ` for ${g.name}` : ""}`}
                      onClick={() => copyPrev(g.no, sn)}
                    >
                      ↑ same
                    </button>
                  ) : (
                    <span />
                  ))}
              </div>
            ))}
          </div>
        ))}
      {singles.length > 0 && (
        <div className="grid-2">
          {singles.map((v) => (
            <div key={v}>
              <label htmlFor={id(v)}>{v}</label>
              <input
                id={id(v)}
                value={getValue(v)}
                onChange={(e) => setValue(v, e.target.value)}
                placeholder={`Enter ${v.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Read-only table of everyone's results for one block
function ResultsTable({
  block,
  members,
  getVal,
  getAll,
  highlight,
  emptyColor,
  unlisted = [],
}) {
  const cols = resultColumns(block);
  const orphanText = (m) =>
    orphanEntries(block, getAll ? getAll(m) : null)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
  const showOrphans = members.some((m) => orphanText(m));
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="results-table">
        <thead>
          <tr>
            <th>Member</th>
            {cols.map((c, i) => (
              <th key={i}>{c.label}</th>
            ))}
            {showOrphans && <th>Earlier setup</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const get = (k) => getVal(m, k);
            return (
              <tr key={m}>
                <td
                  style={{
                    fontWeight: 600,
                    fontSize: "0.87rem",
                    color: m === highlight ? "#FF6B1A" : undefined,
                  }}
                >
                  {m}
                  {m === highlight ? " ★" : ""}
                  {unlisted.includes(m) && (
                    <span
                      className="muted"
                      style={{ fontWeight: 400, fontSize: "0.72rem" }}
                    >
                      {" "}
                      · not on the list
                    </span>
                  )}
                </td>
                {cols.map((c, i) => {
                  const t = c.cell(get);
                  return (
                    <td
                      key={i}
                      style={{
                        color: t ? undefined : emptyColor,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {t || "—"}
                    </td>
                  );
                })}
                {showOrphans && (
                  <td
                    style={{
                      whiteSpace: "pre-line",
                      fontSize: "0.8rem",
                      color: "#c8bfb0",
                    }}
                  >
                    {orphanText(m) || "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Progress over time ───────────────────────────────────────────────────────
// Progress is built from results logged PER EXERCISE (a block's "Log each exercise separately" list),
// because the exercise name is what ties one session to the next.
const parseNum = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const normName = (n) =>
  String(n || "")
    .trim()
    .toLowerCase();
const round1 = (n) => Math.round(n * 10) / 10;
const shortDate = (d) => {
  const x = new Date(d + "T12:00:00");
  return `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}`;
};
const fmtSet = (st) =>
  st.w !== null && st.r !== null
    ? `${st.w} × ${st.r}`
    : st.w !== null
      ? `${st.w} kg`
      : `${st.r} reps`;

// For one block and one person's results: [{ name, sets: [{ w, r }] }], one entry per named exercise
const exerciseEntries = (block, get) => {
  const per = perSetVarsOf(block),
    exs = exercisesOf(block);
  const hasW = per.includes("Weight (kg)"),
    hasR = per.includes("Reps");
  if (!exs.length || (!hasW && !hasR)) return [];
  return exs
    .map((name, i) => {
      const sets = [];
      setNumbers(block).forEach((sn) => {
        const w = hasW
          ? parseNum(get(entryKey("Weight (kg)", sn, i + 1)))
          : null;
        const r = hasR ? parseNum(get(entryKey("Reps", sn, i + 1))) : null;
        if (w !== null || r !== null) sets.push({ w, r });
      });
      return { name, sets };
    })
    .filter((e) => e.sets.length);
};

// A client's own sessions -> progress entries
const entriesFromWorkouts = (workouts) =>
  workouts.flatMap((w) =>
    (w.blocks || []).flatMap((b) => {
      const res = w.results?.[b.name];
      if (!res) return [];
      return exerciseEntries(b, (k) => res[k]).map((e) => ({
        ...e,
        date: w.date,
        session: w.title || "Session",
      }));
    }),
  );

const METRICS = {
  top: {
    label: "Top weight",
    unit: "kg",
    calc: (sets) => {
      const v = sets.filter((s) => s.w !== null).map((s) => s.w);
      return v.length ? Math.max(...v) : null;
    },
  },
  e1rm: {
    label: "Estimated 1RM",
    unit: "kg",
    calc: (sets) => {
      const v = sets
        .filter((s) => s.w !== null && s.r !== null && s.r >= 1)
        .map((s) => (s.r === 1 ? s.w : s.w * (1 + s.r / 30)));
      return v.length ? round1(Math.max(...v)) : null;
    },
  },
  volume: {
    label: "Volume (weight × reps)",
    unit: "kg",
    calc: (sets) => {
      const v = sets.filter((s) => s.w !== null && s.r !== null);
      return v.length ? round1(v.reduce((a, s) => a + s.w * s.r, 0)) : null;
    },
  },
  topReps: {
    label: "Top reps",
    unit: "reps",
    calc: (sets) => {
      const v = sets.filter((s) => s.r !== null).map((s) => s.r);
      return v.length ? Math.max(...v) : null;
    },
  },
  reps: {
    label: "Total reps",
    unit: "reps",
    calc: (sets) => {
      const v = sets.filter((s) => s.r !== null);
      return v.length ? v.reduce((a, s) => a + s.r, 0) : null;
    },
  },
};

function LineChart({ points, unit }) {
  const W = 640,
    H = 230,
    padL = 46,
    padR = 18,
    padT = 18,
    padB = 36;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const margin = (hi - lo) * 0.15;
  lo = Math.max(0, lo - margin);
  hi += margin;
  const n = points.length;
  const x = (i) =>
    n === 1
      ? (padL + (W - padR)) / 2
      : padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [0, 1, 2, 3].map((t) => lo + ((hi - lo) * t) / 3);
  const every = Math.ceil(n / 6);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Progress chart in ${unit}`}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke="rgba(255,255,255,0.08)"
          />
          <text
            x={padL - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill="#8a7a6a"
          >
            {round1(t)}
          </text>
        </g>
      ))}
      {n > 1 && (
        <polyline
          fill="none"
          stroke="#FF6B1A"
          strokeWidth="2.5"
          strokeLinejoin="round"
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
        />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={x(i)}
            cy={y(p.value)}
            r="4.5"
            fill="#FF6B1A"
            stroke="#1a0f07"
            strokeWidth="2"
          >
            <title>{`${shortDate(p.date)}: ${p.value} ${unit}`}</title>
          </circle>
          {(i === 0 || i === n - 1 || n <= 8) && (
            <text
              x={x(i)}
              y={y(p.value) - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#f0ebe3"
            >
              {p.value}
            </text>
          )}
          {(i % every === 0 || i === n - 1) && (
            <text
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#8a7a6a"
            >
              {shortDate(p.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// entries: [{ date, name, sets, session }] from any source (a client's sessions or a class member's results)
function ProgressPanel({ entries }) {
  const [sel, setSel] = useState("");
  const [metricSel, setMetricSel] = useState("");
  const groups = {};
  entries.forEach((e) => {
    const k = normName(e.name);
    (groups[k] = groups[k] || []).push(e);
  });
  const list = Object.entries(groups)
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
      return { key, name: sorted[sorted.length - 1].name, items: sorted };
    })
    .sort(
      (a, b) =>
        b.items.length - a.items.length || a.name.localeCompare(b.name, "sv"),
    );

  if (!list.length) {
    return (
      <p className="muted small">
        No progress to show yet. It's built from results logged per exercise, so
        each exercise needs a name in the block setup ("Log each exercise
        separately") and results with weight or reps.
      </p>
    );
  }
  const g = list.find((x) => x.key === sel) || list[0];
  const available = Object.keys(METRICS).filter((k) =>
    g.items.some((it) => METRICS[k].calc(it.sets) !== null),
  );
  const metric = available.includes(metricSel) ? metricSel : available[0];
  const M = METRICS[metric];
  const pts = g.items
    .map((it) => ({
      date: it.date,
      session: it.session,
      sets: it.sets,
      value: M.calc(it.sets),
    }))
    .filter((pt) => pt.value !== null);
  const vals = pts.map((pt) => pt.value);
  const first = vals[0],
    last = vals[vals.length - 1],
    best = Math.max(...vals);
  const diff = round1(last - first);
  const pct = first ? Math.round(((last - first) / first) * 100) : null;

  return (
    <div>
      <div className="grid-2 mb-3">
        <div>
          <label htmlFor="prog-ex">Exercise</label>
          <select
            id="prog-ex"
            value={g.key}
            onChange={(e) => setSel(e.target.value)}
          >
            {list.map((x) => (
              <option key={x.key} value={x.key}>
                {x.name} ({x.items.length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="prog-metric">Show</label>
          <select
            id="prog-metric"
            value={metric}
            onChange={(e) => setMetricSel(e.target.value)}
          >
            {available.map((k) => (
              <option key={k} value={k}>
                {METRICS[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mb-3" style={{ flexWrap: "wrap" }}>
        <span className="small">
          <span className="muted">First</span>{" "}
          <strong>
            {first} {M.unit}
          </strong>
        </span>
        <span className="small">
          <span className="muted">Latest</span>{" "}
          <strong>
            {last} {M.unit}
          </strong>
        </span>
        <span className="small">
          <span className="muted">Best</span>{" "}
          <strong>
            {best} {M.unit}
          </strong>
        </span>
        {pts.length > 1 && (
          <span
            className="small"
            style={{ color: diff >= 0 ? "#7dde7d" : "#ff9c9c" }}
          >
            <strong>
              {diff > 0 ? "+" : ""}
              {diff} {M.unit}
              {pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}
            </strong>
          </span>
        )}
      </div>

      <LineChart points={pts} unit={M.unit} />
      {pts.length === 1 && (
        <p className="muted small mt-2">
          Only one session logged so far. A trend appears after the next one.
        </p>
      )}

      <div style={{ overflowX: "auto", marginTop: "14px" }}>
        <table className="results-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Session</th>
              <th>Sets</th>
              <th>{M.label}</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().map((pt, i) => (
              <tr key={i}>
                <td>{shortDate(pt.date)}</td>
                <td>{pt.session}</td>
                <td>{pt.sets.map(fmtSet).join(" · ")}</td>
                <td style={{ fontWeight: 600 }}>
                  {pt.value} {M.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Progress for a member of the group classes: collects their results from every session
function ClassProgress({ member, allWorkouts }) {
  const [docs, setDocs] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "classResults"));
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = d.data();
        });
        if (!cancelled) setDocs(map);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (failed)
    return (
      <p style={{ color: "#ff7070", fontSize: "0.85rem" }}>
        Could not load the results. Check your connection and try again.
      </p>
    );
  if (!docs) return <p className="muted small">Loading progress…</p>;
  const entries = allWorkouts.flatMap((w) => {
    const d = docs[String(w.id)];
    if (!d) return [];
    return (w.blocks || []).flatMap((b) => {
      const e = d.results?.[`${b.name}|${member}`];
      if (!e) return [];
      return exerciseEntries(b, (k) => e[k]).map((x) => ({
        ...x,
        date: w.date,
        session: w.title || `Session #${w.sessionNumber}`,
      }));
    });
  });
  return <ProgressPanel entries={entries} />;
}

// ─── Templates: a shared library of sessions the staff can reuse ───────────────
// templates/{id} = { orgId, name, title, blocks, createdBy, createdByName, createdAt }
function TemplateBar({ profile, authUser, getCurrent, onApply, allowApply }) {
  const orgId = profile.orgId,
    uid = authUser.uid;
  const [list, setList] = useState([]);
  const [loadErr, setLoadErr] = useState(false);
  const [picked, setPicked] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "templates"), where("orgId", "==", orgId)),
      (snap) => {
        setList(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name), "sv")),
        );
        setLoadErr(false);
      },
      () => setLoadErr(true),
    );
    return unsub;
  }, [orgId]);

  const chosen = list.find((t) => t.id === picked);
  const canDelete =
    !!chosen && (profile.role === "admin" || chosen.createdBy === uid);

  const apply = () => {
    if (!chosen) return;
    onApply({
      title: chosen.title || "",
      blocks: (chosen.blocks || []).map((b) => ({
        ...b,
        variables: [...(b.variables || [])],
        exercises: [...(b.exercises || [])],
      })),
    });
    setNote(`Loaded "${chosen.name}". Review it, then Save.`);
  };

  const saveAs = async () => {
    const nm = name.trim();
    if (!nm) {
      setNote("Give the template a name.");
      return;
    }
    const cur = getCurrent();
    if (
      !cur.blocks.length ||
      cur.blocks.some((b) => !String(b.description || "").trim())
    ) {
      setNote(
        "Every block needs a description before the session can be saved as a template.",
      );
      return;
    }
    setBusy(true);
    try {
      await setDoc(doc(collection(db, "templates")), {
        orgId,
        name: nm,
        title: String(cur.title || "").trim(),
        blocks: cur.blocks.map((b) => ({
          name: b.name,
          description: b.description.trim(),
          variables: b.variables || [],
          sets: blockSets(b),
          exercises: exercisesOf(b),
        })),
        createdBy: uid,
        createdByName: profile.name || authUser.email,
        createdAt: serverTimestamp(),
      });
      setNaming(false);
      setName("");
      setNote(`Saved as template "${nm}".`);
    } catch {
      setNote(
        "Could not save the template. Check your permissions and try again.",
      );
    }
    setBusy(false);
  };

  const removeTemplate = async () => {
    if (!chosen) return;
    try {
      await deleteDoc(doc(db, "templates", chosen.id));
      setPicked("");
      setConfirmDel(false);
      setNote("Template deleted.");
    } catch {
      setNote("Could not delete the template.");
    }
  };

  return (
    <div className="card mb-3" style={{ padding: "12px 14px" }}>
      <div
        className="muted small"
        style={{
          marginBottom: "8px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Templates
      </div>
      {allowApply && (
        <div
          className="flex gap-2 mb-2"
          style={{ flexWrap: "wrap", alignItems: "center" }}
        >
          <select
            aria-label="Template"
            value={picked}
            onChange={(e) => {
              setPicked(e.target.value);
              setConfirmDel(false);
            }}
            style={{ width: "auto", minWidth: "180px", flex: "1 1 180px" }}
          >
            <option value="">
              {list.length ? "Start from a template…" : "No templates yet"}
            </option>
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!chosen}
            onClick={apply}
          >
            Use
          </button>
          {canDelete &&
            (confirmDel ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmDel(false)}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={removeTemplate}
                >
                  Confirm delete
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setConfirmDel(true)}
              >
                Delete template
              </button>
            ))}
        </div>
      )}
      {naming ? (
        <div
          className="flex gap-2"
          style={{ flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            aria-label="Template name"
            value={name}
            placeholder="Template name"
            onChange={(e) => setName(e.target.value)}
            style={{ flex: "1 1 180px" }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={saveAs}
          >
            {busy ? "Saving…" : "Save template"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setNaming(false);
              setName("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setNaming(true);
            setName(String(getCurrent().title || ""));
            setNote("");
          }}
        >
          Save this session as a template
        </button>
      )}
      {loadErr && (
        <p className="small mt-2" style={{ color: "#ff7070" }}>
          Could not load the templates. Check your connection.
        </p>
      )}
      {note && (
        <p className="small mt-2" style={{ color: "#c8bfb0" }}>
          {note}
        </p>
      )}
    </div>
  );
}

// ─── Class results: one document per session ──────────────────────────────────
// classResults/{sessionId} = { results: { "<block>|<member>": { "<variable>": "value" } },
//                              saved:   { "<block>|<member>": true }, updatedAt }
// Every write only touches ONE member's entry (merge), so two people logging at the same
// time can never overwrite each other, and everyone watching sees changes live.
function useClassResults(wodId) {
  const [data, setData] = useState({ results: {}, saved: {} });
  const [ready, setReady] = useState(false); // true once the first answer from the database has arrived
  const [error, setError] = useState(""); // e.g. "permission-denied" when results can't be read

  useEffect(() => {
    setData({ results: {}, saved: {} });
    setReady(false);
    setError("");
    if (wodId === undefined || wodId === null) return;
    const unsub = onSnapshot(
      doc(db, "classResults", String(wodId)),
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setData({ results: d.results || {}, saved: d.saved || {} });
        setReady(true);
        setError("");
      },
      (err) => {
        console.error("Could not read class results:", err);
        setError(err?.code || "error");
        setReady(true);
      },
    );
    return unsub;
  }, [wodId]);

  const ref = () => doc(db, "classResults", String(wodId));
  const entry = (block, member) => `${block}|${member}`;
  return {
    ready,
    error,
    get: (block, member, variable) =>
      data.results[entry(block, member)]?.[variable] || "",
    isSaved: (block, member) => !!data.saved[entry(block, member)],
    getAll: (block, member) => data.results[entry(block, member)] || {},
    // everyone who has logged anything for this session, whether or not they are on the participant list
    entryMembers: () => {
      const names = new Set();
      [...Object.keys(data.results), ...Object.keys(data.saved)].forEach(
        (k) => {
          const i = k.indexOf("|");
          if (i > 0) names.add(k.slice(i + 1));
        },
      );
      return [...names].sort((a, b) => a.localeCompare(b, "sv"));
    },
    anyForBlock: (block) =>
      Object.keys(data.results).some((k) => k.startsWith(`${block}|`)),
    // one field (used by the admin results table)
    setField: (block, member, variable, value) =>
      setDoc(
        ref(),
        {
          results: { [entry(block, member)]: { [variable]: value } },
          saved: {},
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    // a whole block for one member + mark it as done (used on Home)
    saveBlock: (block, member, vals) => {
      const payload = {
        results: Object.keys(vals).length
          ? { [entry(block, member)]: vals }
          : {},
        saved: { [entry(block, member)]: true },
        updatedAt: serverTimestamp(),
      };
      return setDoc(ref(), payload, { merge: true });
    },
  };
}

// One-time move of the old single-blob results (riggworkout/cf_results + cf_saved_results)
// into the per-session documents. Runs once, when an admin opens the app after the upgrade.
async function migrateLegacyResults(validIds, onStart) {
  const markerRef = doc(db, "riggworkout", "cf_migration");
  const marker = await getDoc(markerRef);
  if (marker.exists() && marker.data().resultsMigrated)
    return { skipped: true, count: 0 };
  onStart && onStart();

  const [rSnap, sSnap] = await Promise.all([
    getDoc(doc(db, "riggworkout", "cf_results")),
    getDoc(doc(db, "riggworkout", "cf_saved_results")),
  ]);
  const legacyResults = rSnap.exists() ? rSnap.data().value || {} : {};
  const legacySaved = sSnap.exists() ? sSnap.data().value || {} : {};

  // legacy key = `${sessionId}_${block}_${member}` (the member name may itself contain "_")
  const split = (key) => {
    const i = key.indexOf("_");
    const j = key.indexOf("_", i + 1);
    return i < 0 || j < 0
      ? null
      : {
          wod: key.slice(0, i),
          block: key.slice(i + 1, j),
          member: key.slice(j + 1),
        };
  };
  const byWod = {};
  const bucket = (wod) =>
    (byWod[wod] = byWod[wod] || { results: {}, saved: {} });

  Object.entries(legacyResults).forEach(([key, vals]) => {
    const p = split(key);
    if (!p || !validIds.has(p.wod) || !vals || typeof vals !== "object") return;
    const clean = {};
    Object.entries(vals).forEach(([variable, value]) => {
      if (value !== "" && value != null) clean[variable] = String(value);
    });
    if (Object.keys(clean).length)
      bucket(p.wod).results[`${p.block}|${p.member}`] = clean;
  });
  Object.entries(legacySaved).forEach(([key, flag]) => {
    const p = split(key);
    if (!p || !flag || !validIds.has(p.wod)) return;
    bucket(p.wod).saved[`${p.block}|${p.member}`] = true;
  });

  let count = 0;
  for (const wod of Object.keys(byWod)) {
    const ref = doc(db, "classResults", wod);
    const existing = await getDoc(ref);
    const ex = existing.exists() ? existing.data() : {};
    const results = {};
    const saved = {};
    // never overwrite anything that has already been logged in the new storage
    Object.entries(byWod[wod].results).forEach(([k, v]) => {
      if (!(ex.results && ex.results[k])) results[k] = v;
    });
    Object.entries(byWod[wod].saved).forEach(([k, v]) => {
      if (!(ex.saved && ex.saved[k])) saved[k] = v;
    });
    if (Object.keys(results).length || Object.keys(saved).length) {
      await setDoc(
        ref,
        { results, saved, updatedAt: serverTimestamp() },
        { merge: true },
      );
      count++;
    }
  }
  await setDoc(
    markerRef,
    { resultsMigrated: true, migratedAt: serverTimestamp() },
    { merge: true },
  );
  return { skipped: false, count };
}

export default function App() {
  const [view, setView] = useState(() =>
    readInviteParam() ? "register" : "member",
  );
  const [inviteCode, setInviteCode] = useState(() => readInviteParam());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishRegistration = async () => {
    registeringRef.current = false;
    setProfileLoading(true);
    await loadProfile(auth.currentUser);
    setProfileLoading(false);
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch {}
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
    } catch {}
    setView("member");
  };
  const [periods, setPeriods] = useState([DEMO_PERIOD]);
  const [activePeriodId, setActivePeriodId] = useState(DEMO_PERIOD.id);
  const [sessionMembers, setSessionMembers] = useState({});
  const [memberRoster, setMemberRoster] = useState(DEFAULT_MEMBERS);
  const [loaded, setLoaded] = useState(false);
  const isAdminUser =
    role === "admin" && !(profile && profile.active === false);
  const [migration, setMigration] = useState(null); // {status: "running" | "done" | "error", count}

  useEffect(() => {
    (async () => {
      const p = await load("cf_periods");
      const sm = await load("cf_session_members");
      const mr = await load("cf_member_roster");
      if (p) setPeriods(p);
      if (sm) setSessionMembers(sm);
      if (mr) setMemberRoster(mr);
      setLoaded(true);
    })();
  }, []);

  // Planning data is only ever written by a signed-in admin (visitors never overwrite it)
  useEffect(() => {
    if (loaded && isAdminUser) save("cf_periods", periods);
  }, [periods, loaded, isAdminUser]);
  useEffect(() => {
    if (loaded && isAdminUser) save("cf_session_members", sessionMembers);
  }, [sessionMembers, loaded, isAdminUser]);
  useEffect(() => {
    if (loaded && isAdminUser) save("cf_member_roster", memberRoster);
  }, [memberRoster, loaded, isAdminUser]);

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

  const activePeriod =
    periods.find((p) => p.id === activePeriodId) || periods[0];
  const allWorkouts = periods.flatMap((p) => p.workouts);

  const setSessionMembersForWod = (wodId, mems) =>
    setSessionMembers((prev) => ({ ...prev, [wodId]: mems }));
  const getSessionMembers = (wodId) => sessionMembers[wodId] || [];

  const updatePeriod = (id, updates) =>
    setPeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  const addPeriod = () => {
    const np = EMPTY_PERIOD();
    setPeriods((prev) => [...prev, np]);
    setActivePeriodId(np.id);
  };
  const dropClassResults = (wodId) => {
    deleteDoc(doc(db, "classResults", String(wodId))).catch(() => {});
  };
  const deletePeriod = (id) => {
    (periods.find((p) => p.id === id)?.workouts || []).forEach((w) =>
      dropClassResults(w.id),
    );
    setPeriods((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.length ? next : [EMPTY_PERIOD()];
    });
    setActivePeriodId((prev) => {
      const rem = periods.filter((p) => p.id !== id);
      return rem.length ? rem[0].id : null;
    });
  };
  const addWorkout = (periodId, wod) =>
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId ? { ...p, workouts: [...p.workouts, wod] } : p,
      ),
    );
  const updateWorkout = (periodId, wod) =>
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId
          ? {
              ...p,
              workouts: p.workouts.map((w) => (w.id === wod.id ? wod : w)),
            }
          : p,
      ),
    );
  const deleteWorkout = (periodId, wodId) => {
    dropClassResults(wodId);
    setPeriods((prev) =>
      prev.map((p) =>
        p.id === periodId
          ? { ...p, workouts: p.workouts.filter((w) => w.id !== wodId) }
          : p,
      ),
    );
  };

  if (!loaded || !authReady)
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
      <style>{css}</style>
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

        {current === "member" && (
          <MemberView
            allWorkouts={allWorkouts}
            periods={periods}
            getSessionMembers={getSessionMembers}
            memberRoster={memberRoster}
          />
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
              } catch {}
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
          (role === "admin" ? (
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
              sessionMembers={sessionMembers}
              setSessionMembersForWod={setSessionMembersForWod}
              getSessionMembers={getSessionMembers}
              memberRoster={memberRoster}
              setMemberRoster={setMemberRoster}
              profile={profile}
              authUser={authUser}
            />
          ) : (
            noAccess
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

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginView({ onRegister }) {
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
    } catch {}
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

function AccountNotice({ email, error, onLogout }) {
  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
    >
      <div className="card text-center" style={{ padding: "32px" }}>
        <h2
          style={{ fontSize: "1.5rem", color: "#FF6B1A", marginBottom: "8px" }}
        >
          ACCOUNT NOT SET UP
        </h2>
        <p className="muted small">
          You're signed in{email ? ` as ${email}` : ""}, but this account isn't
          linked to an organization yet. Ask your admin for an invite.
        </p>
        {error && (
          <p
            style={{ color: "#ff7070", fontSize: "0.82rem", marginTop: "10px" }}
          >
            {error}
          </p>
        )}
        <button className="btn btn-ghost mt-4" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}

function DeactivatedNotice({ email, onLogout }) {
  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
    >
      <div className="card text-center" style={{ padding: "32px" }}>
        <h2
          style={{ fontSize: "1.5rem", color: "#FF6B1A", marginBottom: "8px" }}
        >
          ACCOUNT DEACTIVATED
        </h2>
        <p className="muted small">
          The account{email ? ` ${email}` : ""} has been deactivated. If you
          think this is a mistake, contact your admin.
        </p>
        <button className="btn btn-ghost mt-4" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="section-header mb-3">
      <h4
        style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: "1rem",
          letterSpacing: "0.08em",
          color: "#8a7a6a",
        }}
      >
        {children}
      </h4>
      <div className="section-line" />
    </div>
  );
}

function NoAccess() {
  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
    >
      <div className="card text-center" style={{ padding: "32px" }}>
        <h2
          style={{ fontSize: "1.5rem", color: "#FF6B1A", marginBottom: "8px" }}
        >
          NO ACCESS
        </h2>
        <p className="muted small">
          Your role doesn't have access to this area.
        </p>
      </div>
    </div>
  );
}

// ─── REGISTER (via invite) ─────────────────────────────────────────────────────
function RegisterView({
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
        } catch {}
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

// ─── CLIENTS (people, invites and private plans) ───────────────────────────────
function ClientsView({ profile, authUser, org }) {
  const myRole = profile.role,
    orgId = profile.orgId,
    uid = authUser.uid;
  const [people, setPeople] = useState([]);
  const [invites, setInvites] = useState([]);
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
      !i.used && i.expiresAt?.toMillis && i.expiresAt.toMillis() > Date.now(),
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
        allClients={activeClients}
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

// ─── CLIENT PLAN (a coach's private schedule for one client) ───────────────────
function ClientPlan({
  client,
  profile,
  authUser,
  coachName,
  allClients = [],
  onBack,
}) {
  const today = todayStr();
  const orgId = profile.orgId;
  const [workouts, setWorkouts] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(today));
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [copyClient, setCopyClient] = useState("");
  const [copyDate, setCopyDate] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const copyOptions = allClients.some((c) => c.id === client.id)
    ? allClients
    : [client, ...allClients];

  // Live: the coach sees a client's results the moment they are logged, and setup changes show up at once
  useEffect(() => {
    const base = [
      where("orgId", "==", orgId),
      where("clientId", "==", client.id),
    ];
    const q =
      profile.role === "coach"
        ? query(
            collection(db, "clientWorkouts"),
            ...base,
            where("coachId", "==", authUser.uid),
          )
        : query(collection(db, "clientWorkouts"), ...base);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWorkouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadErr("");
      },
      () =>
        setLoadErr(
          "Could not load this client's sessions. Check your connection and the Firestore rules.",
        ),
    );
    return unsub;
  }, [client.id, orgId, profile.role, authUser.uid]);

  const byDate = {};
  workouts.forEach((w) => {
    (byDate[w.date] = byDate[w.date] || []).push(w);
  });
  Object.values(byDate).forEach((list) =>
    list.sort(
      (a, b) =>
        (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0),
    ),
  );
  const weekDates = getWeekDates(weekStart);
  const wkStartD = new Date(weekDates[0] + "T12:00:00"),
    wkEndD = new Date(weekDates[6] + "T12:00:00");
  const weekLabel = `${wkStartD.getDate()} ${MONTHS[wkStartD.getMonth()].slice(0, 3)} – ${wkEndD.getDate()} ${MONTHS[wkEndD.getMonth()].slice(0, 3)}`;
  const upcoming = workouts
    .filter((w) => w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
  const recent = workouts
    .filter((w) => w.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  // wid given -> edit that session; otherwise add a new one (max 2 per day)
  const openDay = (date, wid) => {
    const list = byDate[date] || [];
    if (!wid && list.length >= 2) return;
    const ex = wid ? list.find((w) => w.id === wid) : null;
    setFormErr("");
    setConfirmDel(false);
    setCopyMsg("");
    setCopyDate("");
    setCopyClient("");
    setWeekStart(getMondayOfWeek(date));
    setEditing(
      ex
        ? {
            id: ex.id,
            date: ex.date,
            title: ex.title || "",
            blocks: (ex.blocks || []).map((b) => ({
              ...b,
              variables: [...(b.variables || [])],
            })),
            results: ex.results || null,
          }
        : {
            date,
            title: "",
            blocks: [
              {
                name: "A",
                description: "",
                variables: ["Rounds", "Weight (kg)"],
              },
            ],
            results: null,
          },
    );
  };

  const setBlock = (i, patch) =>
    setEditing((p) => ({
      ...p,
      blocks: p.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  const addBlock = () =>
    setEditing((p) => {
      const next = ["A", "B", "C", "D"].find(
        (n) => !p.blocks.some((b) => b.name === n),
      );
      return next
        ? {
            ...p,
            blocks: [
              ...p.blocks,
              { name: next, description: "", variables: ["Rounds"] },
            ],
          }
        : p;
    });
  const removeBlock = (i) =>
    setEditing((p) => ({ ...p, blocks: p.blocks.filter((_, j) => j !== i) }));

  const save = async () => {
    setFormErr("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editing.date || "")) {
      setFormErr("Pick a date.");
      return;
    }
    if (!editing.blocks.length) {
      setFormErr("Add at least one block.");
      return;
    }
    if (editing.blocks.some((b) => !b.description.trim())) {
      setFormErr("Every block needs a description.");
      return;
    }
    if (
      workouts.filter((w) => w.date === editing.date && w.id !== editing.id)
        .length >= 2
    ) {
      setFormErr(
        "A day can have at most 2 sessions. Pick another date or open one of the existing sessions.",
      );
      return;
    }
    setSaving(true);
    const blocks = editing.blocks.map((b) => ({
      name: b.name,
      description: b.description.trim(),
      variables: b.variables || [],
      sets: blockSets(b),
      exercises: exercisesOf(b),
    }));
    const base = {
      date: editing.date,
      title: (editing.title || "").trim(),
      blocks,
    };
    try {
      if (editing.id) {
        await updateDoc(doc(db, "clientWorkouts", editing.id), {
          ...base,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(collection(db, "clientWorkouts")), {
          ...base,
          orgId,
          clientId: client.id,
          coachId: client.coachId,
          createdBy: authUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setWeekStart(getMondayOfWeek(base.date));
      setEditing(null);
      setSavedNote("Session saved. The client sees it straight away.");
      setTimeout(() => setSavedNote(""), 5000);
    } catch {
      setFormErr(
        "Could not save. Check your permissions and connection, then try again.",
      );
    }
    setSaving(false);
  };

  // Copies what is in the editor (without results) to another day and/or another client
  const copySession = async () => {
    setCopyMsg("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(copyDate || "")) {
      setCopyMsg("Pick a date to copy to.");
      return;
    }
    if (editing.blocks.some((b) => !b.description.trim())) {
      setCopyMsg("Every block needs a description before it can be copied.");
      return;
    }
    const target =
      copyOptions.find((c) => c.id === (copyClient || client.id)) || client;
    setCopyBusy(true);
    try {
      const baseQ = [
        where("orgId", "==", orgId),
        where("clientId", "==", target.id),
        where("date", "==", copyDate),
      ];
      const q =
        profile.role === "coach"
          ? query(
              collection(db, "clientWorkouts"),
              ...baseQ,
              where("coachId", "==", authUser.uid),
            )
          : query(collection(db, "clientWorkouts"), ...baseQ);
      const existing = await getDocs(q);
      if (existing.size >= 2) {
        setCopyMsg(`${target.name} already has 2 sessions on that day.`);
        setCopyBusy(false);
        return;
      }
      const blocks = editing.blocks.map((b) => ({
        name: b.name,
        description: b.description.trim(),
        variables: b.variables || [],
        sets: blockSets(b),
        exercises: exercisesOf(b),
      }));
      await setDoc(doc(collection(db, "clientWorkouts")), {
        date: copyDate,
        title: (editing.title || "").trim(),
        blocks,
        orgId,
        clientId: target.id,
        coachId: target.coachId,
        createdBy: authUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCopyMsg(
        `Copied to ${target.id === client.id ? "this client" : target.name} on ${formatDate(copyDate)}.`,
      );
    } catch {
      setCopyMsg(
        "Could not copy the session. Check your permissions and try again.",
      );
    }
    setCopyBusy(false);
  };

  const del = async () => {
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    try {
      await deleteDoc(doc(db, "clientWorkouts", editing.id));
      setEditing(null);
    } catch {
      setFormErr("Could not delete the session.");
    }
  };

  // what each block asks the client to log, e.g. "B: 3 exercises × 5 sets"
  const setupSummary = (w) =>
    (w.blocks || [])
      .filter((b) => isDetailed(b) && perSetVarsOf(b).length)
      .map((b) => {
        const n = exercisesOf(b).length,
          st = blockSets(b);
        return `${b.name}: ${[n ? `${n} exercise${n !== 1 ? "s" : ""}` : "", st > 1 ? `${st} sets` : ""].filter(Boolean).join(" × ")}`;
      })
      .join(" · ");

  const sessionRow = (w) => (
    <div
      key={w.id}
      className="card mb-2"
      style={{ padding: "10px 16px", cursor: "pointer" }}
      onClick={() => openDay(w.date, w.id)}
    >
      <div className="flex-between">
        <div>
          <span className="session-tag" style={{ fontSize: "0.72rem" }}>
            {formatDate(w.date)}
          </span>
          <span
            style={{ marginLeft: "8px", fontWeight: 600, fontSize: "0.9rem" }}
          >
            {w.title || "Session"}
          </span>
          {setupSummary(w) && (
            <div className="muted small" style={{ marginTop: "4px" }}>
              Logging: {setupSummary(w)}
            </div>
          )}
        </div>
        <span className="muted small">
          {(w.blocks || []).length} block
          {(w.blocks || []).length !== 1 ? "s" : ""}
          {w.results ? " · results logged" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "900px" }}
    >
      <button className="btn btn-ghost btn-sm mb-3" onClick={onBack}>
        ← All clients
      </button>
      <div className="mb-4">
        <h1 style={{ fontSize: "2rem", color: "#FF6B1A" }}>{client.name}</h1>
        <p className="muted small">
          {client.email} · Coach: {coachName}
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
      {savedNote && (
        <p className="small mb-3" style={{ color: "#7dde7d" }}>
          {savedNote}
        </p>
      )}

      <div className="flex-between mb-3">
        <h3 style={{ fontSize: "1.15rem" }}>{weekLabel}</h3>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            ← Prev
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(getMondayOfWeek(today))}
          >
            This week
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            Next →
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))",
          gap: "8px",
          marginBottom: "28px",
        }}
      >
        {weekDates.map((date, i) => {
          const list = byDate[date] || [];
          const d = new Date(date + "T12:00:00");
          return (
            <div
              key={date}
              role="button"
              tabIndex={0}
              className={`week-day-card ${date === today ? "today-card" : ""} ${list.length ? "has-wod-card" : ""}`}
              style={{ position: "relative" }}
              onClick={() => {
                if (list.length <= 1) openDay(date, list[0]?.id);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && list.length <= 1) {
                  e.preventDefault();
                  openDay(date, list[0]?.id);
                }
              }}
            >
              {date === today && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#FF6B1A",
                  }}
                >
                  ● TODAY
                </span>
              )}
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8a7a6a",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                {DAYS[i]}
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                {d.getDate()}
              </div>
              {list.length > 0 ? (
                <>
                  {list.map((w, k) => (
                    <div
                      key={w.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDay(date, w.id);
                      }}
                      style={{ marginBottom: "8px", cursor: "pointer" }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#c8bfb0" }}>
                        {w.title || `Session ${k + 1}`}
                      </div>
                      <div
                        style={{
                          marginTop: "4px",
                          display: "flex",
                          gap: "3px",
                        }}
                      >
                        {(w.blocks || []).map((b) => (
                          <span
                            key={b.name}
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "3px",
                              background: BLOCK_COLORS[b.name] || "#FF6B1A",
                              display: "inline-block",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {list.length < 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{
                        fontSize: "0.65rem",
                        padding: "3px 6px",
                        whiteSpace: "normal",
                        lineHeight: 1.2,
                        textAlign: "left",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDay(date);
                      }}
                    >
                      + Add session
                    </button>
                  )}
                </>
              ) : (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.2)",
                    marginTop: "8px",
                  }}
                >
                  + Add session
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-header mb-3">
        <h4
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            color: "#8a7a6a",
          }}
        >
          UPCOMING SESSIONS
        </h4>
        <div className="section-line" />
      </div>
      {upcoming.length === 0 ? (
        <p className="muted small mb-4">
          Nothing scheduled yet. Click a day above to add a session.
        </p>
      ) : (
        <div className="mb-4">{upcoming.map(sessionRow)}</div>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-header mb-3">
            <h4
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: "1rem",
                letterSpacing: "0.08em",
                color: "#8a7a6a",
              }}
            >
              RECENT SESSIONS
            </h4>
            <div className="section-line" />
          </div>
          {recent.map(sessionRow)}
        </>
      )}

      <div className="flex-between mt-4 mb-3">
        <h4
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            color: "#8a7a6a",
          }}
        >
          PROGRESS
        </h4>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowProgress((v) => !v)}
        >
          {showProgress ? "Hide" : "Show"}
        </button>
      </div>
      {showProgress && (
        <div className="card mb-4">
          <ProgressPanel entries={entriesFromWorkouts(workouts)} />
        </div>
      )}

      {editing && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="modal-inner">
            <div
              className="modal-header flex-between"
              style={{ flexWrap: "wrap", gap: "10px" }}
            >
              <h3 style={{ color: "#FF6B1A" }}>
                {editing.id ? "Edit session" : "New session"}
              </h3>
              <div className="flex gap-2">
                {editing.id && (
                  <button className="btn btn-danger btn-sm" onClick={del}>
                    {confirmDel ? "Confirm delete" : "Delete"}
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                  onClick={save}
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
            <div className="modal-body">
              {formErr && (
                <div
                  style={{
                    color: "#ff7070",
                    fontSize: "0.85rem",
                    marginBottom: "12px",
                  }}
                >
                  {formErr}
                </div>
              )}
              <TemplateBar
                profile={profile}
                authUser={authUser}
                allowApply={!editing.id}
                getCurrent={() => ({
                  title: editing.title,
                  blocks: editing.blocks,
                })}
                onApply={(t) =>
                  setEditing((p) => ({
                    ...p,
                    title: p.title || t.title,
                    blocks: t.blocks,
                  }))
                }
              />
              {editing.id && (
                <div className="card mb-3" style={{ padding: "12px 14px" }}>
                  <div
                    className="muted small"
                    style={{
                      marginBottom: "8px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Copy this session
                  </div>
                  <div
                    className="flex gap-2"
                    style={{ flexWrap: "wrap", alignItems: "center" }}
                  >
                    <select
                      aria-label="Copy to client"
                      value={copyClient || client.id}
                      onChange={(e) => setCopyClient(e.target.value)}
                      style={{
                        width: "auto",
                        minWidth: "170px",
                        flex: "1 1 170px",
                      }}
                    >
                      {copyOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id === client.id
                            ? `${c.name} (this client)`
                            : c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      aria-label="Copy to date"
                      value={copyDate}
                      onChange={(e) => setCopyDate(e.target.value)}
                      style={{ width: "auto" }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={copyBusy}
                      onClick={copySession}
                    >
                      {copyBusy ? "Copying…" : "Copy"}
                    </button>
                  </div>
                  {copyMsg && (
                    <p className="small mt-2" style={{ color: "#c8bfb0" }}>
                      {copyMsg}
                    </p>
                  )}
                </div>
              )}
              {workouts.some(
                (w) => w.date === editing.date && w.id !== editing.id,
              ) && (
                <p className="muted small mb-3">
                  This day already has another session. A day can have at most
                  2.
                </p>
              )}
              <div className="grid-2 mb-3">
                <div>
                  <label htmlFor="cw-title">Title</label>
                  <input
                    id="cw-title"
                    value={editing.title}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Lower body strength"
                  />
                </div>
                <div>
                  <label htmlFor="cw-date">Date</label>
                  <input
                    id="cw-date"
                    type="date"
                    value={editing.date}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, date: e.target.value }))
                    }
                  />
                </div>
              </div>
              {editing.blocks.map((block, idx) => (
                <div key={block.name} className="card card-orange mb-3">
                  <div className="flex-between mb-2">
                    <span
                      style={{
                        fontWeight: 700,
                        color: BLOCK_COLORS[block.name] || "#FF6B1A",
                      }}
                    >
                      Block {block.name}
                    </span>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => removeBlock(idx)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                    <span
                      className="muted small"
                      style={{ alignSelf: "center" }}
                    >
                      Templates:
                    </span>
                    {Object.keys(BLOCK_TEMPLATES).map((name) => (
                      <button
                        key={name}
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setBlock(idx, templatePatch(name))}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={block.description}
                    onChange={(e) =>
                      setBlock(idx, { description: e.target.value })
                    }
                    placeholder="Block description…"
                    style={{ marginBottom: "8px" }}
                  />
                  <ResultFieldsEditor
                    block={block}
                    onChange={(patch) => setBlock(idx, patch)}
                    hasResults={!!editing.results?.[block.name]}
                  />
                  {editing.results?.[block.name] && (
                    <div className="small mt-2" style={{ color: "#7dde7d" }}>
                      Client's result:{" "}
                      {describeResults(
                        block,
                        (k) => editing.results[block.name][k],
                        editing.results[block.name],
                      ) || "—"}
                    </div>
                  )}
                </div>
              ))}
              {editing.blocks.length < 4 && (
                <button className="btn btn-ghost btn-sm" onClick={addBlock}>
                  + Add Block
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MY PLAN (a client's own sessions and results) ─────────────────────────────
function MyPlanView({ profile, authUser, org }) {
  const today = todayStr();
  const uid = authUser.uid;
  const [workouts, setWorkouts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(today));
  const [sessionIdx, setSessionIdx] = useState(0);
  const [openBlockIdx, setOpenBlockIdx] = useState(null);
  const [drafts, setDrafts] = useState({}); // `${sessionId}_${block}` -> {variable: value}
  const [savingKey, setSavingKey] = useState(null);
  const [saveErr, setSaveErr] = useState("");
  const blockRefs = useRef([]);
  const jumped = useRef(false);
  const [showProgress, setShowProgress] = useState(false);

  // Live: if the coach changes the session (for example which fields to log), it updates here at once
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "clientWorkouts"), where("clientId", "==", uid)),
      (snap) => {
        setWorkouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus("ready");
      },
      () => setStatus("error"),
    );
    return unsub;
  }, [uid]);

  const created = (w) => (w.createdAt?.toMillis ? w.createdAt.toMillis() : 0);
  const wodsForDate = (date) =>
    workouts
      .filter((w) => w.date === date)
      .sort((a, b) => created(a) - created(b));
  const upcoming = workouts
    .filter((w) => w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || created(a) - created(b));
  const recent = workouts
    .filter((w) => w.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || created(a) - created(b));

  // First load: if nothing is planned today, jump to the next planned session
  useEffect(() => {
    if (status !== "ready" || jumped.current) return;
    jumped.current = true;
    if (wodsForDate(today).length === 0 && upcoming.length) {
      setSelectedDate(upcoming[0].date);
      setWeekStart(getMondayOfWeek(upcoming[0].date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    setSessionIdx(0);
  }, [selectedDate]);

  const dayWods = wodsForDate(selectedDate);
  const wod = dayWods[Math.min(sessionIdx, Math.max(dayWods.length - 1, 0))];
  const isSaved = (w, block) => !!w?.doneBlocks?.[block.name];
  const allDone =
    !!wod && wod.blocks.length > 0 && wod.blocks.every((b) => isSaved(wod, b));

  // When the session changes, open the first block that isn't logged yet
  useEffect(() => {
    if (!wod) {
      setOpenBlockIdx(null);
      return;
    }
    const first = wod.blocks.findIndex((b) => !isSaved(wod, b));
    setOpenBlockIdx(first === -1 ? null : first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wod?.id]);

  const pickDate = (date) => {
    setSelectedDate(date);
    setWeekStart(getMondayOfWeek(date));
  };

  const draftFor = (w, block) =>
    drafts[`${w.id}_${block.name}`] ?? w.results?.[block.name] ?? {};
  const setDraft = (w, block, variable, value) =>
    setDrafts((p) => ({
      ...p,
      [`${w.id}_${block.name}`]: {
        ...(p[`${w.id}_${block.name}`] ?? w.results?.[block.name] ?? {}),
        [variable]: value,
      },
    }));

  const handleBlockDone = async (bi) => {
    const block = wod.blocks[bi];
    const key = `${wod.id}_${block.name}`;
    const draft = draftFor(wod, block);
    const vals = {};
    fieldKeys(block).forEach((k) => {
      const t = String(draft[k] ?? "").trim();
      if (t) vals[k] = t.slice(0, 200);
    });
    setSavingKey(key);
    setSaveErr("");
    try {
      await updateDoc(doc(db, "clientWorkouts", wod.id), {
        [`results.${block.name}`]: vals,
        [`doneBlocks.${block.name}`]: true,
        updatedAt: serverTimestamp(),
      });
      const next = bi + 1;
      if (next < wod.blocks.length) {
        setOpenBlockIdx(next);
        setTimeout(() => {
          blockRefs.current[next]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 80);
      } else setOpenBlockIdx(null);
    } catch {
      setSaveErr(
        "Could not save your results. Check your connection and try again.",
      );
    }
    setSavingKey(null);
  };

  if (status === "loading")
    return (
      <div
        className="page text-center muted"
        style={{ position: "relative", zIndex: 1 }}
      >
        Loading your plan…
      </div>
    );
  if (status === "error")
    return (
      <div
        className="page"
        style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}
      >
        <div className="card" style={{ color: "#ff7070", fontSize: "0.9rem" }}>
          Could not load your plan. Check your connection and reload the page.
        </div>
      </div>
    );

  const weekDates = getWeekDates(weekStart);
  const wkA = new Date(weekDates[0] + "T12:00:00"),
    wkB = new Date(weekDates[6] + "T12:00:00");
  const sessionRow = (w) => (
    <div
      key={w.id}
      className="card mb-2"
      style={{ padding: "10px 16px", cursor: "pointer" }}
      onClick={() => pickDate(w.date)}
    >
      <div className="flex-between">
        <div>
          <span className="session-tag" style={{ fontSize: "0.72rem" }}>
            {formatDate(w.date)}
          </span>
          <span
            style={{ marginLeft: "8px", fontWeight: 600, fontSize: "0.9rem" }}
          >
            {w.title || "Session"}
          </span>
        </div>
        <span className="muted small">
          {w.blocks.every((b) => w.doneBlocks?.[b.name])
            ? "✓ logged"
            : `${w.blocks.length} block${w.blocks.length !== 1 ? "s" : ""}`}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "780px" }}
    >
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          className="muted small"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "4px",
          }}
        >
          {org?.name || "Your coach"} · personal program
        </div>
        <h1 style={{ fontSize: "3rem", lineHeight: 1, color: "#FF6B1A" }}>
          MY
          <br />
          PLAN
        </h1>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "12px",
            padding: "5px 14px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: "0.75rem",
            color: "#b9ada0",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="1.5"></rect>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
          </svg>
          Only visible to you and your coach
        </div>
      </div>

      {/* Week navigation + day strip */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex-between mb-2">
          <button
            className="wod-nav-btn"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            ← Week
          </button>
          <span
            style={{ fontSize: "0.82rem", color: "#8a7a6a", fontWeight: 600 }}
          >
            {wkA.getDate()} {MONTHS[wkA.getMonth()].slice(0, 3)} –{" "}
            {wkB.getDate()} {MONTHS[wkB.getMonth()].slice(0, 3)}
          </span>
          <button
            className="wod-nav-btn"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            Week →
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
            gap: "4px",
          }}
        >
          {weekDates.map((date, i) => {
            const count = wodsForDate(date).length;
            const isSel = date === selectedDate;
            const isTod = date === today;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  padding: "8px 4px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: isSel
                    ? "#FF6B1A"
                    : isTod
                      ? "rgba(255,107,26,0.2)"
                      : "rgba(255,255,255,0.04)",
                  color: isSel ? "#fff" : isTod ? "#FF6B1A" : "#f0ebe3",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span
                  style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.7 }}
                >
                  {DAYS[i].slice(0, 1)}
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                  {new Date(date + "T12:00:00").getDate()}
                </span>
                <span style={{ display: "flex", gap: "3px", height: "5px" }}>
                  {Array.from({ length: Math.min(count, 2) }).map((_, k) => (
                    <span
                      key={k}
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: isSel ? "#fff" : "#FF6B1A",
                        display: "block",
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {dayWods.length > 1 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          {dayWods.map((w, i) => (
            <button
              key={w.id}
              type="button"
              className={`period-pill ${wod?.id === w.id ? "active" : ""}`}
              onClick={() => setSessionIdx(i)}
            >
              Session {i + 1}
              {w.title ? ` · ${w.title}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* The selected session */}
      {wod ? (
        <div className="card mb-4">
          <div className="flex-between mb-3">
            <div>
              <span className="session-tag">{formatDate(wod.date)}</span>
              <h3 style={{ fontSize: "1.2rem", marginTop: "6px" }}>
                {wod.title || "Session"}
              </h3>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: wod.date === today ? "#FF6B1A" : "#8a7a6a",
              }}
            >
              {wod.date === today
                ? "● TODAY"
                : wod.date > today
                  ? "Upcoming"
                  : "Past session"}
            </div>
          </div>

          {wod.blocks.map((block, bi) => {
            const key = `${wod.id}_${block.name}`;
            const saved = isSaved(wod, block);
            const open = openBlockIdx === bi;
            const draft = draftFor(wod, block);
            const last = bi === wod.blocks.length - 1;
            return (
              <div
                key={block.name}
                ref={(el) => {
                  blockRefs.current[bi] = el;
                }}
                style={{
                  marginBottom: !last ? "24px" : 0,
                  paddingBottom: !last ? "24px" : 0,
                  borderBottom: !last
                    ? "1px solid rgba(255,255,255,0.06)"
                    : undefined,
                  scrollMarginTop: "80px",
                }}
              >
                <div className="flex-center gap-3 mb-2">
                  <div
                    className="block-badge"
                    style={{
                      background: BLOCK_COLORS[block.name] || "#FF6B1A",
                      color: "#fff",
                    }}
                  >
                    {block.name}
                  </div>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    BLOCK {block.name}
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: "'Barlow',sans-serif",
                    fontSize: "0.95rem",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    color: "#e0d8ce",
                    paddingLeft: "40px",
                  }}
                >
                  {block.description}
                </pre>

                <div style={{ marginLeft: "40px", marginTop: "12px" }}>
                  {saved && !open ? (
                    <button
                      type="button"
                      onClick={() => setOpenBlockIdx(bi)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(80,200,80,0.25)",
                        background: "rgba(80,200,80,0.06)",
                        color: "#7dde7d",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>✓ Results logged for Block {block.name}</span>
                      <span style={{ color: "#8a7a6a", fontWeight: 500 }}>
                        Edit
                      </span>
                    </button>
                  ) : open ? (
                    <div
                      className="card"
                      style={{
                        border: "1px solid rgba(255,107,26,0.25)",
                        padding: "16px",
                      }}
                    >
                      <p
                        className="muted small"
                        style={{ marginBottom: "12px" }}
                      >
                        {describeFields(block).replace("Members log:", "Log:")}
                      </p>
                      <ResultInputs
                        block={block}
                        idPrefix={key}
                        getValue={(k) => draft[k] ?? ""}
                        setValue={(k, val) => setDraft(wod, block, k, val)}
                      />
                      {saveErr && (
                        <div
                          style={{
                            color: "#ff7070",
                            fontSize: "0.82rem",
                            marginTop: "10px",
                          }}
                        >
                          {saveErr}
                        </div>
                      )}
                      <button
                        className="btn btn-primary mt-3 w-full"
                        style={{
                          justifyContent: "center",
                          opacity: savingKey === key ? 0.6 : 1,
                        }}
                        disabled={savingKey === key}
                        onClick={() => handleBlockDone(bi)}
                      >
                        {savingKey === key
                          ? "Saving…"
                          : `✓ Done — ${!last ? `Next: Block ${wod.blocks[bi + 1].name}` : "Finish"}`}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setOpenBlockIdx(bi)}
                    >
                      Log results for Block {block.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {allDone && (
            <div
              className="mt-4"
              style={{
                padding: "14px 18px",
                textAlign: "center",
                borderRadius: "10px",
                border: "1px solid rgba(80,200,80,0.2)",
                background: "rgba(80,200,80,0.04)",
              }}
            >
              <div style={{ color: "#7dde7d", fontWeight: 600 }}>
                ✓ All results saved — great work, {profile.name}!
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center mb-4" style={{ padding: "32px" }}>
          <p className="muted">
            No session planned for {formatDate(selectedDate)}
          </p>
          <p className="muted small mt-2">
            Pick another day above, or check your upcoming sessions below.
          </p>
        </div>
      )}

      <SectionTitle>UPCOMING SESSIONS</SectionTitle>
      {upcoming.length === 0 ? (
        <p className="muted small mb-4">
          Nothing scheduled yet. Your coach will add sessions here.
        </p>
      ) : (
        <div className="mb-4">{upcoming.slice(0, 8).map(sessionRow)}</div>
      )}

      {recent.length > 0 && (
        <>
          <SectionTitle>RECENT SESSIONS</SectionTitle>
          {recent.slice(0, 8).map(sessionRow)}
        </>
      )}

      <div className="flex-between mt-4 mb-3">
        <h4
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            color: "#8a7a6a",
          }}
        >
          MY PROGRESS
        </h4>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowProgress((v) => !v)}
        >
          {showProgress ? "Hide" : "Show"}
        </button>
      </div>
      {showProgress && (
        <div className="card mb-4">
          <ProgressPanel entries={entriesFromWorkouts(workouts)} />
        </div>
      )}
    </div>
  );
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────
function AdminView({
  periods,
  activePeriod,
  activePeriodId,
  setActivePeriodId,
  updatePeriod,
  addPeriod,
  deletePeriod,
  addWorkout,
  updateWorkout,
  deleteWorkout,
  sessionMembers,
  setSessionMembersForWod,
  getSessionMembers,
  memberRoster,
  setMemberRoster,
  profile,
  authUser,
}) {
  const [tab, setTab] = useState("today");
  const [confirmDel, setConfirmDel] = useState(false);
  const [periodExpanded, setPeriodExpanded] = useState(false);

  return (
    <div className="page" style={{ position: "relative", zIndex: 1 }}>
      <div className="flex-between mb-4">
        <div>
          <h1 style={{ fontSize: "2rem", color: "#FF6B1A" }}>CLASSES</h1>
          <p className="muted small">
            Group sessions, planning and participants
          </p>
        </div>
      </div>

      {/* Period bar */}
      <div className="card mb-4" style={{ padding: "16px 20px" }}>
        <div className="flex-between mb-3">
          <h3 style={{ fontSize: "1rem", color: "#FF6B1A" }}>
            Training Periods
          </h3>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPeriodExpanded((p) => !p)}
            >
              {periodExpanded ? "Hide Details" : "Edit Details"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                addPeriod();
                setPeriodExpanded(true);
              }}
            >
              + New Period
            </button>
          </div>
        </div>
        <div className="period-list">
          {periods.map((p) => (
            <button
              key={p.id}
              className={`period-pill ${activePeriodId === p.id ? "active" : ""}`}
              onClick={() => {
                setActivePeriodId(p.id);
                setConfirmDel(false);
              }}
            >
              {p.name || "Unnamed Period"}
            </button>
          ))}
        </div>
        {activePeriod && !periodExpanded && (
          <p className="muted small mt-2">
            {activePeriod.focus ? `${activePeriod.focus} · ` : ""}
            {activePeriod.startDate && activePeriod.durationWeeks
              ? `${formatDate(activePeriod.startDate)} – ${formatDate(addDays(activePeriod.startDate, activePeriod.durationWeeks * 7 - 1))}`
              : "No dates set"}
          </p>
        )}
        {activePeriod && periodExpanded && (
          <>
            <div className="grid-2 mt-3">
              <div>
                <label>Period Name</label>
                <input
                  value={activePeriod.name}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, { name: e.target.value })
                  }
                  placeholder="e.g. Spring Strength Block"
                />
              </div>
              <div>
                <label>Focus / Theme</label>
                <input
                  value={activePeriod.focus}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, { focus: e.target.value })
                  }
                  placeholder="e.g. Back Squat & Gymnastics"
                />
              </div>
              <div>
                <label>Start Date</label>
                <input
                  type="date"
                  value={activePeriod.startDate || todayStr()}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, { startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label>Duration (weeks)</label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={activePeriod.durationWeeks || 8}
                  onChange={(e) =>
                    updatePeriod(activePeriod.id, {
                      durationWeeks: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex-between mt-3">
              <p className="muted small">
                {activePeriod.startDate && activePeriod.durationWeeks
                  ? `Ends: ${formatDate(addDays(activePeriod.startDate, activePeriod.durationWeeks * 7 - 1))}`
                  : ""}
              </p>
              <div className="flex gap-2">
                {confirmDel && (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#ff7070",
                      alignSelf: "center",
                    }}
                  >
                    Delete this period?
                  </span>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirmDel) {
                      deletePeriod(activePeriodId);
                      setConfirmDel(false);
                    } else setConfirmDel(true);
                  }}
                >
                  {confirmDel ? "Confirm Delete" : "Delete Period"}
                </button>
                {confirmDel && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmDel(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {[
          ["today", "Today's Session"],
          ["planner", "Week Planner"],
          ["members", "Members"],
          ["history", "History"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={`admin-tab ${tab === k ? "active" : ""}`}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "today" && activePeriod && (
        <TodayAdmin
          period={activePeriod}
          updateWorkout={updateWorkout}
          addWorkout={addWorkout}
          deleteWorkout={deleteWorkout}
          getSessionMembers={getSessionMembers}
          setSessionMembersForWod={setSessionMembersForWod}
          memberRoster={memberRoster}
        />
      )}
      {tab === "planner" && activePeriod && (
        <PlannerAdmin
          period={activePeriod}
          updateWorkout={updateWorkout}
          addWorkout={addWorkout}
          deleteWorkout={deleteWorkout}
          memberRoster={memberRoster}
          getSessionMembers={getSessionMembers}
          setSessionMembersForWod={setSessionMembersForWod}
          profile={profile}
          authUser={authUser}
        />
      )}
      {tab === "members" && (
        <MembersAdmin
          memberRoster={memberRoster}
          setMemberRoster={setMemberRoster}
          allWorkouts={periods.flatMap((p) => p.workouts)}
        />
      )}
      {tab === "history" && (
        <HistoryAdmin periods={periods} getSessionMembers={getSessionMembers} />
      )}
    </div>
  );
}

// ─── TODAY ADMIN ───────────────────────────────────────────────────────────────
function TodayAdmin({
  period,
  updateWorkout,
  addWorkout,
  deleteWorkout,
  getSessionMembers,
  setSessionMembersForWod,
  memberRoster,
}) {
  const today = todayStr();
  const todayWods = period.workouts
    .filter((w) => w.date === today)
    .sort(
      (a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0) || a.id - b.id,
    );
  const canAddMore = todayWods.length < 2;
  const [editing, setEditing] = useState(null);

  const startNew = () => {
    if (!canAddMore) return;
    const nums = period.workouts.map((w) => w.sessionNumber);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const wod = { ...EMPTY_WOD(), sessionNumber: next, date: today };
    addWorkout(period.id, wod);
    setEditing(wod.id);
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <div className="session-tag">📅 {formatDate(today)}</div>
          {period.focus && (
            <p className="muted small mt-1">Focus: {period.focus}</p>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={startNew}
          disabled={!canAddMore}
          style={!canAddMore ? { opacity: 0.45, cursor: "not-allowed" } : {}}
        >
          + New WoD
        </button>
      </div>
      {!canAddMore && (
        <p className="muted small mb-3">A day can have at most 2 sessions.</p>
      )}
      {todayWods.length === 0 && (
        <div className="card text-center" style={{ padding: "40px" }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>💪</div>
          <p className="muted">No workout scheduled for today. Create one!</p>
        </div>
      )}
      {todayWods.map((wod) => (
        <WodEditor
          key={wod.id}
          wod={wod}
          periodId={period.id}
          isEditing={editing === wod.id}
          onEdit={() => setEditing(editing === wod.id ? null : wod.id)}
          onSave={(w) => {
            updateWorkout(period.id, w);
            setEditing(null);
          }}
          onDelete={() => {
            deleteWorkout(period.id, wod.id);
            if (editing === wod.id) setEditing(null);
          }}
          getSessionMembers={getSessionMembers}
          setSessionMembersForWod={setSessionMembersForWod}
          memberRoster={memberRoster}
        />
      ))}
    </div>
  );
}

// ─── WOD EDITOR ───────────────────────────────────────────────────────────────
function WodEditor({
  wod,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  getSessionMembers,
  setSessionMembersForWod,
  memberRoster,
}) {
  const cr = useClassResults(wod.id);
  const [local, setLocal] = useState(wod);
  const members = getSessionMembers(wod.id);
  const resultMembers = [
    ...members,
    ...cr.entryMembers().filter((m) => !members.includes(m)),
  ];
  useEffect(() => setLocal(wod), [wod]);
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [confirmDel, setConfirmDel] = useState(false);
  const toggleBlockView = (name) =>
    setExpandedBlocks((p) => ({ ...p, [name]: !p[name] }));

  const addBlock = () => {
    const n = ["A", "B", "C", "D"],
      u = local.blocks.map((b) => b.name),
      next = n.find((x) => !u.includes(x));
    if (!next) return;
    setLocal((p) => ({
      ...p,
      blocks: [
        ...p.blocks,
        { name: next, description: "", variables: ["Rounds"] },
      ],
    }));
  };
  const removeBlock = (i) =>
    setLocal((p) => ({ ...p, blocks: p.blocks.filter((_, j) => j !== i) }));
  const updateBlock = (i, u) =>
    setLocal((p) => ({
      ...p,
      blocks: p.blocks.map((b, j) => (j === i ? { ...b, ...u } : b)),
    }));
  const toggleMember = (name) => {
    const cur = getSessionMembers(wod.id);
    if (cur.includes(name)) {
      setSessionMembersForWod(
        wod.id,
        cur.filter((n) => n !== name),
      );
    } else if (cur.length < 16) {
      setSessionMembersForWod(wod.id, [...cur, name]);
    }
  };

  return (
    <div className="card mb-4">
      <div
        className="flex-between mb-3"
        style={{ flexWrap: "wrap", gap: "8px" }}
      >
        <div className="flex-center gap-3" style={{ flexWrap: "wrap" }}>
          {isEditing ? (
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div style={{ width: "110px" }}>
                <label style={{ marginBottom: "3px" }}>Session #</label>
                <input
                  type="number"
                  value={local.sessionNumber}
                  onChange={(e) =>
                    setLocal((p) => ({
                      ...p,
                      sessionNumber: Number(e.target.value),
                    }))
                  }
                  style={{ padding: "5px 8px", fontSize: "0.88rem" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ marginBottom: "3px" }}>WoD Title</label>
                <input
                  value={local.title}
                  onChange={(e) =>
                    setLocal((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="WoD Title"
                  style={{ padding: "5px 10px", fontSize: "0.9rem" }}
                />
              </div>
            </div>
          ) : (
            <>
              <span className="session-tag">Session #{wod.sessionNumber}</span>
              <h3 style={{ fontSize: "1.1rem" }}>
                {wod.title || "Untitled WoD"}
              </h3>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}>
            {isEditing ? "Cancel" : "Edit"}
          </button>
          {isEditing && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                onSave({ ...local, blocks: local.blocks.map(cleanBlock) })
              }
            >
              Save
            </button>
          )}
          {confirmDel && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmDel(false)}
            >
              Keep
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (!confirmDel) {
                setConfirmDel(true);
                return;
              }
              onDelete();
            }}
          >
            {confirmDel ? "Confirm delete" : "Delete"}
          </button>
        </div>
      </div>

      {isEditing ? (
        <>
          {local.blocks.map((block, idx) => (
            <div key={idx} className="card card-orange mb-3">
              <div className="flex-between mb-2">
                <div className="flex-center gap-2">
                  <div
                    className="block-badge"
                    style={{
                      background: BLOCK_COLORS[block.name] || "#FF6B1A",
                      color: "#fff",
                    }}
                  >
                    {block.name}
                  </div>
                  <span style={{ fontWeight: 600 }}>Block {block.name}</span>
                </div>
                <button
                  className="btn btn-danger btn-xs"
                  onClick={() => removeBlock(idx)}
                >
                  Remove
                </button>
              </div>
              <div className="flex gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                <span className="muted small" style={{ alignSelf: "center" }}>
                  Templates:
                </span>
                {Object.keys(BLOCK_TEMPLATES).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => updateBlock(idx, templatePatch(name))}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <textarea
                value={block.description}
                onChange={(e) =>
                  updateBlock(idx, { description: e.target.value })
                }
                placeholder="Describe the block…"
                style={{ marginBottom: "10px" }}
              />
              <div>
                <label>Result Variables</label>
                <ResultFieldsEditor
                  block={block}
                  onChange={(patch) => updateBlock(idx, patch)}
                  hasResults={cr.anyForBlock(block.name)}
                />
              </div>
            </div>
          ))}
          {local.blocks.length < 4 && (
            <button className="btn btn-ghost btn-sm mb-4" onClick={addBlock}>
              + Add Block
            </button>
          )}
        </>
      ) : (
        <div className="mb-4">
          {wod.blocks.map((block, idx) => {
            const resultsOpen = !!expandedBlocks[block.name];
            return (
              <div
                key={idx}
                style={{
                  marginBottom: "16px",
                  paddingLeft: "12px",
                  borderLeft: `3px solid ${BLOCK_COLORS[block.name] || "#FF6B1A"}`,
                }}
              >
                <div className="flex-center gap-2 mb-1">
                  <div
                    className="block-badge"
                    style={{
                      background: BLOCK_COLORS[block.name] || "#FF6B1A",
                      color: "#fff",
                      width: "22px",
                      height: "22px",
                      fontSize: "0.8rem",
                    }}
                  >
                    {block.name}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    Block {block.name}
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: "'Barlow',sans-serif",
                    fontSize: "0.85rem",
                    color: "#c8bfb0",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {block.description}
                </pre>
                {resultMembers.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => toggleBlockView(block.name)}
                    >
                      {resultsOpen ? "▲ Hide Results" : "▼ View Results"}
                    </button>
                    {resultsOpen && (
                      <div style={{ marginTop: "10px", overflowX: "auto" }}>
                        <table className="results-table">
                          <thead>
                            <tr>
                              <th>Member</th>
                              {fieldList(block).map((f) => (
                                <th key={f.key}>{f.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resultMembers.map((member) => (
                              <tr key={member}>
                                <td
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.87rem",
                                  }}
                                >
                                  {member}
                                  {!members.includes(member) && (
                                    <span
                                      className="muted"
                                      style={{
                                        fontWeight: 400,
                                        fontSize: "0.72rem",
                                      }}
                                    >
                                      {" "}
                                      · not on the list
                                    </span>
                                  )}
                                </td>
                                {fieldKeys(block).map((v) => (
                                  <td key={v}>
                                    <input
                                      key={cr.get(block.name, member, v)}
                                      defaultValue={cr.get(
                                        block.name,
                                        member,
                                        v,
                                      )}
                                      onBlur={(e) => {
                                        const nv = e.target.value;
                                        if (
                                          nv !== cr.get(block.name, member, v)
                                        )
                                          cr.setField(
                                            block.name,
                                            member,
                                            v,
                                            nv,
                                          ).catch(() => {});
                                      }}
                                      placeholder="—"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Participant management */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: "16px",
          marginTop: "8px",
        }}
      >
        <h4
          style={{ fontSize: "0.9rem", marginBottom: "10px", color: "#FF6B1A" }}
        >
          Class Participants ({members.length}/16)
        </h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {memberRoster.map((name) => (
            <button
              key={name}
              className={`member-pill ${members.includes(name) ? "active" : ""}`}
              onClick={() => toggleMember(name)}
              disabled={!members.includes(name) && members.length >= 16}
              style={
                !members.includes(name) && members.length >= 16
                  ? { opacity: 0.35, cursor: "not-allowed" }
                  : {}
              }
            >
              {members.includes(name) ? "✓ " : ""}
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MEMBERS ADMIN ─────────────────────────────────────────────────────────────
function MembersAdmin({ memberRoster, setMemberRoster, allWorkouts = [] }) {
  const [newName, setNewName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [progressFor, setProgressFor] = useState(null);

  const addMember = () => {
    const n = newName.trim();
    if (!n || memberRoster.includes(n) || memberRoster.length >= 30) return;
    setMemberRoster([...memberRoster, n]);
    setNewName("");
  };

  const deleteMember = (name) => {
    if (confirmDel === name) {
      setMemberRoster(memberRoster.filter((n) => n !== name));
      setConfirmDel(null);
    } else {
      setConfirmDel(name);
      setEditingName(null);
    }
  };

  const startEdit = (name) => {
    setEditingName(name);
    setEditValue(name);
    setConfirmDel(null);
  };

  const saveEdit = (originalName) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingName(null);
      return;
    }
    // don't allow duplicate names (ignore the one being edited)
    if (memberRoster.some((n) => n === trimmed && n !== originalName)) {
      setEditingName(null);
      return;
    }
    setMemberRoster(
      memberRoster.map((n) => (n === originalName ? trimmed : n)),
    );
    setEditingName(null);
  };

  const filteredRoster = memberRoster.filter((n) =>
    n.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h3 style={{ fontSize: "1.1rem" }}>Member Roster</h3>
          <p className="muted small mt-1">
            {memberRoster.length}/30 members · Max 16 per class session
          </p>
        </div>
      </div>

      {/* Add member */}
      {memberRoster.length < 30 ? (
        <div className="card mb-4" style={{ padding: "16px 20px" }}>
          <label>Add New Member</label>
          <div className="flex gap-3 mt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter full name…"
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              style={{ maxWidth: "300px" }}
            />
            <button className="btn btn-primary btn-sm" onClick={addMember}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <div className="card mb-4 card-orange" style={{ padding: "12px 16px" }}>
          <p style={{ fontSize: "0.85rem", color: "#FF9A4D" }}>
            Maximum of 30 members reached.
          </p>
        </div>
      )}

      {/* Search */}
      {memberRoster.length > 0 && (
        <div className="mb-3" style={{ maxWidth: "300px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search members…"
          />
        </div>
      )}

      {/* Roster grid */}
      {filteredRoster.length === 0 && memberRoster.length > 0 ? (
        <p className="muted small">No members match "{search}".</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))",
            gap: "8px",
          }}
        >
          {filteredRoster.map((name, i) => (
            <div
              key={name}
              className="card"
              style={{
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <div
                className="flex-center gap-2"
                style={{ flex: 1, minWidth: 0 }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "rgba(255,107,26,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#FF6B1A",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                {editingName === name ? (
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(name);
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    autoFocus
                    style={{ padding: "3px 8px", fontSize: "0.88rem", flex: 1 }}
                  />
                ) : (
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                )}
              </div>

              <div className="flex gap-1" style={{ flexShrink: 0 }}>
                {editingName === name ? (
                  <>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => saveEdit(name)}
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setEditingName(null)}
                    >
                      ✕
                    </button>
                  </>
                ) : confirmDel === name ? (
                  <>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => deleteMember(name)}
                    >
                      Delete
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setConfirmDel(null)}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setProgressFor(name)}
                      title={`Progress for ${name}`}
                    >
                      Progress
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => startEdit(name)}
                      style={{ color: "#c8bfb0" }}
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => deleteMember(name)}
                      style={{ color: "#ff7070" }}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {progressFor && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setProgressFor(null)}
        >
          <div className="modal-inner">
            <div className="modal-header flex-between">
              <h3 style={{ color: "#FF6B1A" }}>Progress · {progressFor}</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setProgressFor(null)}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              <ClassProgress
                key={progressFor}
                member={progressFor}
                allWorkouts={allWorkouts}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PLANNER ADMIN ─────────────────────────────────────────────────────────────
function PlannerAdmin({
  period,
  updateWorkout,
  addWorkout,
  deleteWorkout,
  memberRoster,
  getSessionMembers,
  setSessionMembersForWod,
  profile,
  authUser,
}) {
  const today = todayStr();
  const periodMonday = getMondayOfWeek(period.startDate || today);
  const totalWeeks = period.durationWeeks || 8;
  const [weekOffset, setWeekOffset] = useState(() => {
    const todayM = getMondayOfWeek(today);
    const diff = Math.round(
      (new Date(todayM + "T12:00:00") - new Date(periodMonday + "T12:00:00")) /
        (7 * 24 * 3600 * 1000),
    );
    return Math.max(0, Math.min(totalWeeks - 1, diff));
  });
  const [selDate, setSelDate] = useState(null);
  const [editWod, setEditWod] = useState(null);
  const [modalTab, setModalTab] = useState("wod"); // "wod" | "participants"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyDate, setCopyDate] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const weekStart = addDays(periodMonday, weekOffset * 7);
  const weekDates = getWeekDates(weekStart);
  const wodsForDate = (date) =>
    period.workouts
      .filter((w) => w.date === date)
      .sort(
        (a, b) =>
          (a.sessionNumber || 0) - (b.sessionNumber || 0) || a.id - b.id,
      );

  // wodId given -> edit that session; otherwise add a new one (max 2 per day)
  const openDay = (date, wodId) => {
    const list = wodsForDate(date);
    if (!wodId && list.length >= 2) return;
    setSelDate(date);
    setModalTab("wod");
    setConfirmDelete(false);
    setCopyDate("");
    setCopyMsg("");
    const ex = wodId ? list.find((w) => w.id === wodId) : null;
    if (ex) {
      setEditWod({ ...ex, blocks: ex.blocks.map((b) => ({ ...b })) });
    } else {
      const nums = period.workouts.map((w) => w.sessionNumber);
      setEditWod({
        ...EMPTY_WOD(),
        date,
        sessionNumber: nums.length ? Math.max(...nums) + 1 : 1,
      });
    }
  };
  const saveWod = () => {
    const exists = period.workouts.some((w) => w.id === editWod.id);
    const cleaned = { ...editWod, blocks: editWod.blocks.map(cleanBlock) };
    if (exists) updateWorkout(period.id, cleaned);
    else addWorkout(period.id, cleaned);
    setSelDate(null);
    setEditWod(null);
  };
  // Copy this session (without results or participants) to another day, as a new session
  const copyWod = () => {
    setCopyMsg("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(copyDate || "")) {
      setCopyMsg("Pick a date to copy to.");
      return;
    }
    if (editWod.blocks.some((b) => !String(b.description || "").trim())) {
      setCopyMsg("Every block needs a description before it can be copied.");
      return;
    }
    if (wodsForDate(copyDate).length >= 2) {
      setCopyMsg("That day already has 2 sessions.");
      return;
    }
    const nums = period.workouts.map((w) => w.sessionNumber);
    const blocks = editWod.blocks.map((b) => ({
      ...cleanBlock(b),
      variables: [...(b.variables || [])],
    }));
    addWorkout(period.id, {
      ...editWod,
      blocks,
      id: Date.now(),
      date: copyDate,
      sessionNumber: nums.length ? Math.max(...nums) + 1 : 1,
    });
    setCopyMsg(`Copied to ${formatDate(copyDate)}.`);
  };

  const deleteDay = () => {
    const ex = period.workouts.find((w) => w.id === editWod.id);
    if (ex && !confirmDelete) {
      setConfirmDelete(true);
      return;
    } // saved sessions need a second click to confirm
    if (ex) {
      deleteWorkout(period.id, ex.id);
      setSessionMembersForWod(ex.id, []);
    }
    setSelDate(null);
    setEditWod(null);
  };

  // Participants for the currently-open modal (use wodId if exists, else use selDate as temp key)
  const currentWodId = editWod?.id;
  const sessionMems = currentWodId ? getSessionMembers(currentWodId) : [];
  const toggleParticipant = (name) => {
    if (!currentWodId) return;
    const cur = getSessionMembers(currentWodId);
    if (cur.includes(name))
      setSessionMembersForWod(
        currentWodId,
        cur.filter((n) => n !== name),
      );
    else if (cur.length < 16)
      setSessionMembersForWod(currentWodId, [...cur, name]);
  };

  const allWeeks = Array.from({ length: totalWeeks }, (_, i) =>
    getWeekDates(addDays(periodMonday, i * 7)),
  );

  return (
    <div>
      <div className="flex-between mb-4">
        <h3 style={{ fontSize: "1.2rem" }}>
          Week {weekOffset + 1} of {totalWeeks}
        </h3>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset <= 0}
          >
            ← Prev
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const d = getMondayOfWeek(today);
              const diff = Math.round(
                (new Date(d + "T12:00:00") -
                  new Date(periodMonday + "T12:00:00")) /
                  (7 * 24 * 3600 * 1000),
              );
              setWeekOffset(Math.max(0, Math.min(totalWeeks - 1, diff)));
            }}
          >
            This Week
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setWeekOffset((w) => Math.min(totalWeeks - 1, w + 1))
            }
            disabled={weekOffset >= totalWeeks - 1}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: "8px",
          marginBottom: "32px",
        }}
      >
        {weekDates.map((date, i) => {
          const list = wodsForDate(date);
          const d = new Date(date + "T12:00:00");
          return (
            <div
              key={date}
              className={`week-day-card ${date === today ? "today-card" : ""} ${list.length ? "has-wod-card" : ""}`}
              onClick={() => {
                if (list.length <= 1) openDay(date, list[0]?.id);
              }}
              style={{ position: "relative" }}
            >
              {date === today && (
                <span
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    letterSpacing: "0.05em",
                    color: "#FF6B1A",
                  }}
                >
                  ● TODAY
                </span>
              )}
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8a7a6a",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: "4px",
                }}
              >
                {DAYS[i]}
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  marginBottom: "6px",
                }}
              >
                {d.getDate()}
              </div>
              {list.length > 0 ? (
                <>
                  {list.map((wod) => {
                    const participants = getSessionMembers(wod.id);
                    return (
                      <div
                        key={wod.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDay(date, wod.id);
                        }}
                        style={{ marginBottom: "8px", cursor: "pointer" }}
                      >
                        <div
                          className="session-tag"
                          style={{ fontSize: "0.68rem", padding: "2px 7px" }}
                        >
                          #{wod.sessionNumber}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            marginTop: "4px",
                            color: "#c8bfb0",
                          }}
                        >
                          {wod.title || "WoD"}
                        </div>
                        <div
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            gap: "3px",
                          }}
                        >
                          {wod.blocks.map((b) => (
                            <span
                              key={b.name}
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                background: BLOCK_COLORS[b.name] || "#FF6B1A",
                                display: "inline-block",
                              }}
                            />
                          ))}
                        </div>
                        {participants.length > 0 && (
                          <div
                            style={{
                              marginTop: "6px",
                              fontSize: "0.68rem",
                              color: "#FF9A4D",
                            }}
                          >
                            👥 {participants.length}/16
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {list.length < 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      style={{
                        marginTop: "2px",
                        fontSize: "0.65rem",
                        padding: "3px 6px",
                        whiteSpace: "normal",
                        lineHeight: 1.2,
                        textAlign: "left",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDay(date);
                      }}
                    >
                      + Add session
                    </button>
                  )}
                </>
              ) : (
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.2)",
                    marginTop: "8px",
                  }}
                >
                  + Add WoD
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 8-week overview */}
      <div className="section-header">
        <h4
          style={{
            fontSize: "0.85rem",
            color: "#8a7a6a",
            fontFamily: "'Barlow Condensed',sans-serif",
            letterSpacing: "0.08em",
          }}
        >
          {totalWeeks}-WEEK OVERVIEW
        </h4>
        <div className="section-line" />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          marginBottom: "32px",
        }}
      >
        {allWeeks.map((week, wi) => {
          const sessionCount = week.reduce(
            (n, d) => n + wodsForDate(d).length,
            0,
          );
          const s = new Date(week[0] + "T12:00:00"),
            e = new Date(week[6] + "T12:00:00");
          return (
            <div
              key={wi}
              className={`card ${weekOffset === wi ? "card-orange" : ""}`}
              style={{ padding: "10px 16px", cursor: "pointer" }}
              onClick={() => setWeekOffset(wi)}
            >
              <div className="flex-between">
                <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Week {wi + 1}: {s.getDate()}{" "}
                  {MONTHS[s.getMonth()].slice(0, 3)} – {e.getDate()}{" "}
                  {MONTHS[e.getMonth()].slice(0, 3)}
                </span>
                <div className="flex gap-2">
                  <div
                    style={{
                      display: "flex",
                      gap: "3px",
                      alignItems: "center",
                    }}
                  >
                    {week.map((d) => {
                      const w = wodsForDate(d).length > 0;
                      return (
                        <span
                          key={d}
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "2px",
                            background: w ? "#FF6B1A" : "rgba(255,255,255,0.1)",
                            display: "inline-block",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="muted small">
                    {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day modal */}
      {selDate && editWod && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && (setSelDate(null), setEditWod(null))
          }
        >
          <div className="modal-inner">
            {/* Modal header — a true fixed header, not part of the scrolling body, so Save/Cancel/Delete are always reachable with no gap */}
            <div
              className="modal-header flex-between"
              style={{ flexWrap: "wrap", gap: "10px" }}
            >
              <h3 style={{ color: "#FF6B1A" }}>{formatDate(selDate)}</h3>
              <div className="flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={deleteDay}>
                  {confirmDelete ? "Confirm delete" : "Delete"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setSelDate(null);
                    setEditWod(null);
                  }}
                >
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveWod}>
                  Save
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Modal tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  marginBottom: "18px",
                }}
              >
                {[
                  ["wod", "WoD"],
                  ["participants", `Participants (${sessionMems.length}/16)`],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    style={{
                      padding: "7px 16px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: modalTab === k ? "#FF6B1A" : "#8a7a6a",
                      fontFamily: "'Barlow',sans-serif",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      borderBottom:
                        modalTab === k
                          ? "2px solid #FF6B1A"
                          : "2px solid transparent",
                      marginBottom: "-1px",
                      transition: "all 0.15s",
                    }}
                    onClick={() => setModalTab(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* WoD tab */}
              {modalTab === "wod" && (
                <>
                  {profile && authUser && (
                    <TemplateBar
                      profile={profile}
                      authUser={authUser}
                      allowApply={
                        !period.workouts.some((w) => w.id === editWod.id)
                      }
                      getCurrent={() => ({
                        title: editWod.title,
                        blocks: editWod.blocks,
                      })}
                      onApply={(t) =>
                        setEditWod((p) => ({
                          ...p,
                          title: p.title || t.title,
                          blocks: t.blocks,
                        }))
                      }
                    />
                  )}
                  {period.workouts.some((w) => w.id === editWod.id) && (
                    <div className="card mb-3" style={{ padding: "12px 14px" }}>
                      <div
                        className="muted small"
                        style={{
                          marginBottom: "8px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Copy this session
                      </div>
                      <div
                        className="flex gap-2"
                        style={{ flexWrap: "wrap", alignItems: "center" }}
                      >
                        <input
                          type="date"
                          aria-label="Copy to date"
                          value={copyDate}
                          onChange={(e) => setCopyDate(e.target.value)}
                          style={{ width: "auto" }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={copyWod}
                        >
                          Copy to this day
                        </button>
                      </div>
                      {copyMsg && (
                        <p className="small mt-2" style={{ color: "#c8bfb0" }}>
                          {copyMsg}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="grid-2 mb-3">
                    <div>
                      <label>WoD Title</label>
                      <input
                        value={editWod.title}
                        onChange={(e) =>
                          setEditWod((p) => ({ ...p, title: e.target.value }))
                        }
                        placeholder="Session name"
                      />
                    </div>
                    <div>
                      <label>Session #</label>
                      <input
                        type="number"
                        value={editWod.sessionNumber}
                        onChange={(e) =>
                          setEditWod((p) => ({
                            ...p,
                            sessionNumber: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  {editWod.blocks.map((block, idx) => (
                    <div key={idx} className="card card-orange mb-3">
                      <div className="flex-between mb-2">
                        <span
                          style={{
                            fontWeight: 700,
                            color: BLOCK_COLORS[block.name] || "#FF6B1A",
                          }}
                        >
                          Block {block.name}
                        </span>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() =>
                            setEditWod((p) => ({
                              ...p,
                              blocks: p.blocks.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          ✕
                        </button>
                      </div>
                      <div
                        className="flex gap-2 mb-2"
                        style={{ flexWrap: "wrap" }}
                      >
                        <span
                          className="muted small"
                          style={{ alignSelf: "center" }}
                        >
                          Templates:
                        </span>
                        {Object.keys(BLOCK_TEMPLATES).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              setEditWod((p) => ({
                                ...p,
                                blocks: p.blocks.map((b, i) =>
                                  i === idx
                                    ? { ...b, ...templatePatch(name) }
                                    : b,
                                ),
                              }))
                            }
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={block.description}
                        onChange={(e) =>
                          setEditWod((p) => ({
                            ...p,
                            blocks: p.blocks.map((b, i) =>
                              i === idx
                                ? { ...b, description: e.target.value }
                                : b,
                            ),
                          }))
                        }
                        placeholder="Block description…"
                        style={{ marginBottom: "8px" }}
                      />
                      <ResultFieldsEditor
                        block={block}
                        onChange={(patch) =>
                          setEditWod((p) => ({
                            ...p,
                            blocks: p.blocks.map((b, i) =>
                              i === idx ? { ...b, ...patch } : b,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                  {editWod.blocks.length < 4 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const n = ["A", "B", "C", "D"],
                          u = editWod.blocks.map((b) => b.name),
                          next = n.find((x) => !u.includes(x));
                        if (next)
                          setEditWod((p) => ({
                            ...p,
                            blocks: [
                              ...p.blocks,
                              {
                                name: next,
                                description: "",
                                variables: ["Rounds"],
                              },
                            ],
                          }));
                      }}
                    >
                      + Add Block
                    </button>
                  )}
                </>
              )}

              {/* Participants tab */}
              {modalTab === "participants" && (
                <div>
                  <div className="flex-between mb-3">
                    <p style={{ fontSize: "0.85rem", color: "#c8bfb0" }}>
                      Select up to 16 participants for this session.
                    </p>
                    {sessionMems.length > 0 && (
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          setSessionMembersForWod(currentWodId, [])
                        }
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {memberRoster.length === 0 ? (
                    <p className="muted small">
                      No members in roster yet. Add members in the Members tab
                      first.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {memberRoster.map((name) => {
                        const isIn = sessionMems.includes(name);
                        const isFull = !isIn && sessionMems.length >= 16;
                        return (
                          <button
                            key={name}
                            className={`member-pill ${isIn ? "active" : ""}`}
                            onClick={() => toggleParticipant(name)}
                            disabled={isFull}
                            style={
                              isFull
                                ? { opacity: 0.35, cursor: "not-allowed" }
                                : {}
                            }
                          >
                            {isIn ? "✓ " : ""}
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {sessionMems.length > 0 && (
                    <div
                      style={{
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "#8a7a6a",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: "8px",
                        }}
                      >
                        Registered ({sessionMems.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {sessionMems.map((name) => (
                          <span
                            key={name}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "20px",
                              background: "rgba(255,107,26,0.12)",
                              border: "1px solid rgba(255,107,26,0.25)",
                              color: "#FF9A4D",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                            }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY ADMIN ─────────────────────────────────────────────────────────────
function HistoryAdmin({ periods, getSessionMembers }) {
  const [selPeriod, setSelPeriod] = useState(periods[0]?.id);
  const [selWod, setSelWod] = useState(null);
  const today = todayStr();
  const period = periods.find((p) => p.id === selPeriod);
  const past = period
    ? [...period.workouts]
        .filter((w) => w.date <= today)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const wod = past.find((w) => w.id === selWod);
  const cr = useClassResults(wod?.id);
  return (
    <div>
      <div className="period-list mb-4">
        {periods.map((p) => (
          <button
            key={p.id}
            className={`period-pill ${selPeriod === p.id ? "active" : ""}`}
            onClick={() => {
              setSelPeriod(p.id);
              setSelWod(null);
            }}
          >
            {p.name || "Unnamed"}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div>
          <h4
            style={{
              fontSize: "0.88rem",
              color: "#8a7a6a",
              marginBottom: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Past Sessions
          </h4>
          {past.length === 0 && (
            <p className="muted small">No past sessions yet.</p>
          )}
          {past.map((w) => (
            <div
              key={w.id}
              className={`card mb-2 ${selWod === w.id ? "card-orange" : ""}`}
              style={{ cursor: "pointer", padding: "12px 16px" }}
              onClick={() => setSelWod(w.id)}
            >
              <div className="flex-between">
                <div>
                  <span className="session-tag" style={{ fontSize: "0.72rem" }}>
                    #{w.sessionNumber}
                  </span>
                  <span
                    style={{
                      marginLeft: "8px",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    {w.title || "WoD"}
                  </span>
                </div>
                <span className="muted small">{formatDate(w.date)}</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          {wod ? (
            <div>
              <h4
                style={{
                  fontSize: "0.88rem",
                  color: "#8a7a6a",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Session #{wod.sessionNumber} Results
              </h4>
              <p
                style={{
                  fontSize: "0.82rem",
                  marginBottom: "12px",
                  color: "#c8bfb0",
                }}
              >
                {formatDate(wod.date)}
              </p>
              {wod.blocks.map((block, bi) => {
                const listed = getSessionMembers(wod.id);
                const mems = [
                  ...listed,
                  ...cr.entryMembers().filter((m) => !listed.includes(m)),
                ];
                return (
                  <div key={bi} className="card mb-3">
                    <div className="flex-center gap-2 mb-2">
                      <div
                        className="block-badge"
                        style={{
                          background: BLOCK_COLORS[block.name] || "#FF6B1A",
                          color: "#fff",
                          width: "22px",
                          height: "22px",
                          fontSize: "0.8rem",
                        }}
                      >
                        {block.name}
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        Block {block.name}
                      </span>
                    </div>
                    {mems.length === 0 ? (
                      <p className="muted small">No participants recorded.</p>
                    ) : (
                      <ResultsTable
                        block={block}
                        members={mems}
                        unlisted={mems.filter((m) => !listed.includes(m))}
                        emptyColor="#555"
                        getVal={(m, k) => cr.get(block.name, m, k)}
                        getAll={(m) => cr.getAll(block.name, m)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card text-center" style={{ padding: "40px" }}>
              <p className="muted">Select a session to view results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MEMBER VIEW ───────────────────────────────────────────────────────────────
function MemberView({ allWorkouts, periods, getSessionMembers, memberRoster }) {
  const today = todayStr();
  const todayMonday = getMondayOfWeek(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [memberName, setMemberName] = useState(() => {
    try {
      return localStorage.getItem("rigg_member_name") || "";
    } catch {
      return "";
    }
  });
  const [calMonth, setCalMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  useEffect(() => {
    try {
      if (memberName) localStorage.setItem("rigg_member_name", memberName);
      else localStorage.removeItem("rigg_member_name");
    } catch {}
  }, [memberName]);

  const weekStart = addDays(todayMonday, weekOffset * 7);
  const weekDates = getWeekDates(weekStart);

  // When week offset changes, anchor selected date
  useEffect(() => {
    if (!weekDates.includes(selectedDate)) {
      const todayInWeek = weekDates.includes(today);
      const firstWod = weekDates.find((d) =>
        allWorkouts.some((w) => w.date === d),
      );
      setSelectedDate(todayInWeek ? today : firstWod || weekDates[0]);
    }
  }, [weekOffset]);

  const wodsForDate = (date) =>
    allWorkouts
      .filter((w) => w.date === date)
      .sort(
        (a, b) =>
          (a.sessionNumber || 0) - (b.sessionNumber || 0) || a.id - b.id,
      );
  const dayWods = wodsForDate(selectedDate);
  const [sessionIdx, setSessionIdx] = useState(0);
  useEffect(() => {
    setSessionIdx(0);
  }, [selectedDate]); // always start on the first session of a day
  const wod = dayWods[Math.min(sessionIdx, Math.max(dayWods.length - 1, 0))];
  const period = periods.find((p) => p.workouts.some((w) => w.id === wod?.id));
  const sessionMems = wod ? getSessionMembers(wod.id) : [];

  // Class results live in one document per session, with one entry per member and block
  const cr = useClassResults(wod?.id);
  const [drafts, setDrafts] = useState({}); // block name -> {variable: value} typed by the selected member
  const [saveErr, setSaveErr] = useState("");
  useEffect(() => {
    setDrafts({});
    setSaveErr("");
  }, [wod?.id, memberName]);
  const valueFor = (block, v) =>
    drafts[block.name]?.[v] ?? cr.get(block.name, memberName, v);
  // Anyone who logs a result is shown on the session, even if they weren't ticked as a participant
  const resultMems = [
    ...sessionMems,
    ...cr.entryMembers().filter((m) => !sessionMems.includes(m)),
  ];
  const unlistedMems = resultMems.filter((m) => !sessionMems.includes(m));
  const isBlockSaved = (block) =>
    !!(wod && memberName && cr.isSaved(block.name, memberName));
  const allBlocksSaved =
    wod &&
    memberName &&
    wod.blocks.length > 0 &&
    wod.blocks.every(isBlockSaved);

  const [openBlockIdx, setOpenBlockIdx] = useState(null);
  const blockRefs = useRef([]);
  const [openClassResults, setOpenClassResults] = useState({});
  const [showProgress, setShowProgress] = useState(false);
  const toggleClassResults = (name) =>
    setOpenClassResults((p) => ({ ...p, [name]: !p[name] }));
  useEffect(() => {
    setOpenClassResults({});
  }, [wod?.id]);

  // When the WoD or the selected member changes, jump to the first not-yet-logged block
  useEffect(() => {
    if (!wod || !memberName) {
      setOpenBlockIdx(null);
      return;
    }
    if (!cr.ready) return; // wait until this session's saved results have loaded
    const firstIncomplete = wod.blocks.findIndex((b) => !isBlockSaved(b));
    setOpenBlockIdx(firstIncomplete === -1 ? null : firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wod?.id, memberName, cr.ready]);

  const handleBlockDone = (bi) => {
    const block = wod.blocks[bi];
    const vals = {};
    fieldKeys(block).forEach((k) => {
      vals[k] = String(valueFor(block, k) ?? "")
        .trim()
        .slice(0, 200);
    });
    setSaveErr("");
    // saved instantly on this device, then synced; if the database refuses it we say so
    cr.saveBlock(block.name, memberName, vals).catch((err) => {
      console.error("Saving results failed:", err);
      setSaveErr(
        `Your results could not be saved (${err?.code || "error"}). Check your connection and press Done again.`,
      );
      setOpenBlockIdx(bi); // bring the block back, with everything you typed still in it
    });
    const next = bi + 1;
    if (next < wod.blocks.length) {
      setOpenBlockIdx(next);
      setTimeout(() => {
        blockRefs.current[next]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
    } else {
      setOpenBlockIdx(null);
    }
  };

  const touchStart = useRef(null);
  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    const ci = weekDates.indexOf(selectedDate);
    if (dx > 60 && ci > 0) setSelectedDate(weekDates[ci - 1]);
    else if (dx < -60 && ci < 6) setSelectedDate(weekDates[ci + 1]);
    touchStart.current = null;
  };

  // Calendar helpers
  const calDays = () => {
    const first = new Date(calMonth.year, calMonth.month, 1);
    const last = new Date(calMonth.year, calMonth.month + 1, 0);
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(d);
    return days;
  };
  const calDateStr = (d) => {
    if (!d) return null;
    return `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  const jumpToDate = (ds) => {
    setSelectedDate(ds);
    const newMonday = getMondayOfWeek(ds);
    const diff = Math.round(
      (new Date(newMonday + "T12:00:00") -
        new Date(todayMonday + "T12:00:00")) /
        (7 * 24 * 3600 * 1000),
    );
    setWeekOffset(diff);
  };

  return (
    <div
      className="page"
      style={{ position: "relative", zIndex: 1, maxWidth: "780px" }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          className="muted small"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "4px",
          }}
        >
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
        <h1 style={{ fontSize: "3rem", lineHeight: 1, color: "#FF6B1A" }}>
          WORKOUT
          <br />
          OF THE DAY
        </h1>
        {period && (
          <p className="muted small mt-2">
            {period.name}
            {period.focus ? ` · ${period.focus}` : ""}
          </p>
        )}
      </div>

      {/* Week navigation + day strip */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex-between mb-2">
          <button
            className="wod-nav-btn"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            ← Week
          </button>
          <span
            style={{ fontSize: "0.82rem", color: "#8a7a6a", fontWeight: 600 }}
          >
            {new Date(weekDates[0] + "T12:00:00").getDate()}{" "}
            {MONTHS[new Date(weekDates[0] + "T12:00:00").getMonth()].slice(
              0,
              3,
            )}{" "}
            – {new Date(weekDates[6] + "T12:00:00").getDate()}{" "}
            {MONTHS[new Date(weekDates[6] + "T12:00:00").getMonth()].slice(
              0,
              3,
            )}
          </span>
          <button
            className="wod-nav-btn"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            Week →
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
            gap: "4px",
          }}
        >
          {weekDates.map((date, i) => {
            const dayCount = wodsForDate(date).length;
            const isSel = date === selectedDate;
            const isTod = date === today;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                style={{
                  padding: "8px 4px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: isSel
                    ? "#FF6B1A"
                    : isTod
                      ? "rgba(255,107,26,0.2)"
                      : "rgba(255,255,255,0.04)",
                  color: isSel ? "#fff" : isTod ? "#FF6B1A" : "#f0ebe3",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span
                  style={{ fontSize: "0.65rem", fontWeight: 700, opacity: 0.7 }}
                >
                  {DAYS[i].slice(0, 1)}
                </span>
                <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                  {new Date(date + "T12:00:00").getDate()}
                </span>
                <span style={{ display: "flex", gap: "3px", height: "5px" }}>
                  {Array.from({ length: Math.min(dayCount, 2) }).map((_, k) => (
                    <span
                      key={k}
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: isSel ? "#fff" : "#FF6B1A",
                        display: "block",
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two sessions on the same day: pick which one to view */}
      {dayWods.length > 1 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          {dayWods.map((w, i) => (
            <button
              key={w.id}
              type="button"
              className={`period-pill ${wod?.id === w.id ? "active" : ""}`}
              onClick={() => setSessionIdx(i)}
            >
              Session {i + 1}
              {w.title ? ` · ${w.title}` : ""}
            </button>
          ))}
        </div>
      )}

      {/* Member selector — above the WoD card, always visible without scrolling */}
      {wod && (
        <div className="card mb-4" style={{ padding: "12px 18px" }}>
          <div
            className="flex-between"
            style={{ flexWrap: "wrap", gap: "10px" }}
          >
            <label
              htmlFor="member-select"
              style={{
                fontSize: "0.75rem",
                color: "#8a7a6a",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: 0,
              }}
            >
              Who are you?
            </label>
            <div style={{ maxWidth: "220px", flex: "1 1 180px" }}>
              <select
                id="member-select"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                style={{ fontWeight: 600 }}
              >
                <option value="">Select your name…</option>
                {memberRoster.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* WoD card or empty state */}
      {wod ? (
        <div
          className="card mb-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex-between mb-3">
            <div>
              <span className="session-tag">Session #{wod.sessionNumber}</span>
              <h3 style={{ fontSize: "1.2rem", marginTop: "6px" }}>
                {wod.title || "WoD"}
              </h3>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: selectedDate === today ? "#FF6B1A" : "#8a7a6a",
              }}
            >
              {selectedDate === today
                ? "● TODAY"
                : selectedDate > today
                  ? "Upcoming"
                  : "Past session"}
            </div>
          </div>
          {cr.error && (
            <div
              className="mb-3"
              style={{ color: "#ff7070", fontSize: "0.82rem" }}
            >
              Class results can't be loaded right now ({cr.error}). Please try
              again in a moment.
            </div>
          )}
          {wod.blocks.map((block, bi) => {
            const saved = isBlockSaved(block);
            const open = openBlockIdx === bi;
            return (
              <div
                key={bi}
                ref={(el) => {
                  blockRefs.current[bi] = el;
                }}
                style={{
                  marginBottom: bi < wod.blocks.length - 1 ? "24px" : 0,
                  paddingBottom: bi < wod.blocks.length - 1 ? "24px" : 0,
                  borderBottom:
                    bi < wod.blocks.length - 1
                      ? "1px solid rgba(255,255,255,0.06)"
                      : undefined,
                  scrollMarginTop: "80px",
                }}
              >
                <div className="flex-center gap-3 mb-2">
                  <div
                    className="block-badge"
                    style={{
                      background: BLOCK_COLORS[block.name] || "#FF6B1A",
                      color: "#fff",
                    }}
                  >
                    {block.name}
                  </div>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "0.04em",
                    }}
                  >
                    BLOCK {block.name}
                  </span>
                </div>
                <pre
                  style={{
                    fontFamily: "'Barlow',sans-serif",
                    fontSize: "0.95rem",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    color: "#e0d8ce",
                    paddingLeft: "40px",
                  }}
                >
                  {block.description}
                </pre>

                {memberName && (
                  <div style={{ marginLeft: "40px", marginTop: "12px" }}>
                    {saved && !open ? (
                      <button
                        type="button"
                        onClick={() => setOpenBlockIdx(bi)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: "1px solid rgba(80,200,80,0.25)",
                          background: "rgba(80,200,80,0.06)",
                          color: "#7dde7d",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>✓ Results logged for Block {block.name}</span>
                        <span style={{ color: "#8a7a6a", fontWeight: 500 }}>
                          Edit
                        </span>
                      </button>
                    ) : open ? (
                      <div
                        className="card"
                        style={{
                          border: "1px solid rgba(255,107,26,0.25)",
                          padding: "16px",
                        }}
                      >
                        <p
                          className="muted small"
                          style={{ marginBottom: "12px" }}
                        >
                          {describeFields(block).replace(
                            "Members log:",
                            "Log:",
                          )}
                        </p>
                        <ResultInputs
                          block={block}
                          idPrefix={`home_${wod.id}_${block.name}`}
                          getValue={(k) => valueFor(block, k)}
                          setValue={(k, val) =>
                            setDrafts((p) => ({
                              ...p,
                              [block.name]: {
                                ...(p[block.name] || {}),
                                [k]: val,
                              },
                            }))
                          }
                        />
                        {saveErr && (
                          <div
                            style={{
                              color: "#ff7070",
                              fontSize: "0.82rem",
                              marginTop: "10px",
                            }}
                          >
                            {saveErr}
                          </div>
                        )}
                        <button
                          className="btn btn-primary mt-3 w-full"
                          style={{ justifyContent: "center" }}
                          onClick={() => handleBlockDone(bi)}
                        >
                          ✓ Done —{" "}
                          {bi < wod.blocks.length - 1
                            ? `Next: Block ${wod.blocks[bi + 1].name}`
                            : "Finish"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setOpenBlockIdx(bi)}
                      >
                        Log Results for Block {block.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {allBlocksSaved && (
            <div
              className="mt-4"
              style={{
                padding: "14px 18px",
                textAlign: "center",
                borderRadius: "10px",
                border: "1px solid rgba(80,200,80,0.2)",
                background: "rgba(80,200,80,0.04)",
              }}
            >
              <div style={{ color: "#7dde7d", fontWeight: 600 }}>
                ✓ All results saved — great work, {memberName}!
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center mb-4" style={{ padding: "32px" }}>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🗓️</div>
          <p className="muted">
            No session planned for {formatDate(selectedDate)}
          </p>
          <p className="muted small mt-2">
            Use the arrows above to browse the week, or tap a date in the
            calendar below.
          </p>
        </div>
      )}

      {/* Class results table */}
      {wod && resultMems.length > 0 && (
        <div className="mb-6">
          <div className="section-header mb-3">
            <h4
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: "1rem",
                letterSpacing: "0.08em",
                color: "#8a7a6a",
              }}
            >
              CLASS RESULTS
            </h4>
            <div className="section-line" />
          </div>
          {wod.blocks.map((block, bi) => {
            const open = !!openClassResults[block.name];
            return (
              <div key={bi} className="card mb-3">
                <div
                  className="flex-between"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleClassResults(block.name)}
                >
                  <div className="flex-center gap-2">
                    <div
                      className="block-badge"
                      style={{
                        background: BLOCK_COLORS[block.name] || "#FF6B1A",
                        color: "#fff",
                        width: "22px",
                        height: "22px",
                        fontSize: "0.78rem",
                      }}
                    >
                      {block.name}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                      Block {block.name}
                    </span>
                  </div>
                  <span className="muted small">
                    {open ? "▲ Hide" : "▼ View"}
                  </span>
                </div>
                {open && (
                  <div style={{ marginTop: "12px" }}>
                    <ResultsTable
                      block={block}
                      members={resultMems}
                      unlisted={unlistedMems}
                      highlight={memberName}
                      emptyColor="#444"
                      getVal={(m, k) => cr.get(block.name, m, k)}
                      getAll={(m) => cr.getAll(block.name, m)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Progress for the selected member */}
      {memberName && (
        <div className="card mb-4">
          <div className="flex-between">
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#8a7a6a",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                My progress
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                {memberName}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowProgress((v) => !v)}
            >
              {showProgress ? "Hide" : "Show"}
            </button>
          </div>
          {showProgress && (
            <div className="mt-3">
              <ClassProgress
                key={memberName}
                member={memberName}
                allWorkouts={allWorkouts}
              />
            </div>
          )}
        </div>
      )}

      {/* Mini calendar */}
      <div className="card">
        <div className="flex-between mb-3">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() =>
              setCalMonth((m) => ({
                ...m,
                month: m.month === 0 ? 11 : m.month - 1,
                year: m.month === 0 ? m.year - 1 : m.year,
              }))
            }
          >
            ←
          </button>
          <h4
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: "1rem",
              letterSpacing: "0.06em",
            }}
          >
            {MONTHS[calMonth.month]} {calMonth.year}
          </h4>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() =>
              setCalMonth((m) => ({
                ...m,
                month: m.month === 11 ? 0 : m.month + 1,
                year: m.month === 11 ? m.year + 1 : m.year,
              }))
            }
          >
            →
          </button>
        </div>
        <div className="cal-grid mb-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: "0.7rem",
                color: "#8a7a6a",
                fontWeight: 700,
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="cal-grid">
          {calDays().map((d, i) => {
            const ds = calDateStr(d);
            const hasWod = ds ? allWorkouts.some((w) => w.date === ds) : false;
            const isTod = ds === today;
            const isSel = ds === selectedDate;
            return (
              <div
                key={i}
                className={`cal-day ${hasWod ? "has-wod" : ""} ${isTod ? "is-today" : ""} ${isSel && !isTod ? "is-selected" : ""} ${!d ? "other-month" : ""}`}
                onClick={() => {
                  if (d && ds) jumpToDate(ds);
                }}
              >
                {d && (
                  <>
                    <span>{d}</span>
                    {hasWod && <div className="cal-dot" />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
