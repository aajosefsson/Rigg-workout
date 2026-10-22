import { MONTHS } from "./dates";
import { entryKey, exercisesOf, perSetVarsOf, setNumbers } from "./resultFields";

// Progress is built from results logged PER EXERCISE (a block's "Log each exercise separately" list),
// because the exercise name is what ties one session to the next.

export const parseNum = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const normName = (n) => String(n || "").trim().toLowerCase();
export const round1 = (n) => Math.round(n * 10) / 10;
export const shortDate = (d) => {
  const x = new Date(d + "T12:00:00");
  return `${x.getDate()} ${MONTHS[x.getMonth()].slice(0, 3)}`;
};
export const fmtSet = (st) =>
  st.w !== null && st.r !== null
    ? `${st.w} × ${st.r}`
    : st.w !== null
      ? `${st.w} kg`
      : `${st.r} reps`;

// For one block and one person's results: [{ name, sets: [{ w, r }] }], one entry per named exercise
export const exerciseEntries = (block, get) => {
  const per = perSetVarsOf(block);
  const exs = exercisesOf(block);
  const hasW = per.includes("Weight (kg)");
  const hasR = per.includes("Reps");
  if (!exs.length || (!hasW && !hasR)) return [];
  return exs
    .map((name, i) => {
      const sets = [];
      setNumbers(block).forEach((sn) => {
        const w = hasW ? parseNum(get(entryKey("Weight (kg)", sn, i + 1))) : null;
        const r = hasR ? parseNum(get(entryKey("Reps", sn, i + 1))) : null;
        if (w !== null || r !== null) sets.push({ w, r });
      });
      return { name, sets };
    })
    .filter((e) => e.sets.length);
};

// A client's own sessions -> progress entries
export const entriesFromWorkouts = (workouts) =>
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

// A class member's results across all sessions. docs = { [wodId]: { results: { "block|member": {...} } } }
export const entriesFromClassResults = (allWorkouts, docs, member) =>
  allWorkouts.flatMap((w) => {
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

export const METRICS = {
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

// Groups entries by exercise name (case-insensitive), oldest first inside each group,
// most-logged exercise first in the list
export const groupByExercise = (entries) => {
  const groups = {};
  entries.forEach((e) => {
    const k = normName(e.name);
    (groups[k] = groups[k] || []).push(e);
  });
  return Object.entries(groups)
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
      return { key, name: sorted[sorted.length - 1].name, items: sorted };
    })
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, "sv"));
};

// Summary of a metric over a group's sessions, or null when nothing can be calculated
export const summarize = (items, metricKey) => {
  const M = METRICS[metricKey];
  const pts = items
    .map((it) => ({ date: it.date, session: it.session, sets: it.sets, value: M.calc(it.sets) }))
    .filter((pt) => pt.value !== null);
  if (!pts.length) return null;
  const vals = pts.map((pt) => pt.value);
  const first = vals[0];
  const last = vals[vals.length - 1];
  return {
    pts,
    first,
    last,
    best: Math.max(...vals),
    diff: round1(last - first),
    pct: first ? Math.round(((last - first) / first) * 100) : null,
  };
};
