// ─── Detailed result fields ────────────────────────────────────────────────────
// Some fields are asked once per block ("Rounds", "Comment"). Weight, reps, time and distance
// can be asked per SET (block.sets > 1), per EXERCISE (block.exercises = ["Squat", ...]), or both.
// Stored under keys like "Weight (kg)", "Weight (kg)#2" (set 2), "Weight (kg)@3" (exercise 3)
// and "Weight (kg)#2@3" (set 2 of exercise 3).
export const PER_SET_ORDER = ["Weight (kg)", "Reps", "Time", "Distance (m)"];
export const SET_SHORT = {
  "Weight (kg)": "kg",
  Reps: "reps",
  Time: "time",
  "Distance (m)": "m",
};
export const blockSets = (block) =>
  Math.max(1, Math.min(10, Number(block?.sets) || 1));
export const exercisesOf = (block) =>
  Array.isArray(block?.exercises)
    ? block.exercises
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter(Boolean)
    : [];
export const isDetailed = (block) =>
  blockSets(block) > 1 || exercisesOf(block).length > 0;
export const perSetVarsOf = (block) =>
  isDetailed(block)
    ? PER_SET_ORDER.filter((v) => (block.variables || []).includes(v))
    : [];
export const singleVarsOf = (block) =>
  (block.variables || []).filter((v) => !perSetVarsOf(block).includes(v));
export const entryKey = (v, setNo, exNo) =>
  `${v}${setNo ? `#${setNo}` : ""}${exNo ? `@${exNo}` : ""}`;
export const shortName = (v) => v.replace(/ \(.*\)/, "").toLowerCase();
export const setNumbers = (block) =>
  blockSets(block) > 1
    ? Array.from({ length: blockSets(block) }, (_, i) => i + 1)
    : [0];
export const exerciseGroups = (block) => {
  const ex = exercisesOf(block);
  return ex.length
    ? ex.map((name, i) => ({ name, no: i + 1 }))
    : [{ name: "", no: 0 }];
};
export const cleanBlock = (b) => ({ ...b, exercises: exercisesOf(b) }); // run when a session is saved: no empty names

// Every input a member fills in for a block, in order, with a readable label
export const fieldList = (block) => {
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
export const fieldKeys = (block) => fieldList(block).map((f) => f.key);

// "90 kg · 5 reps" for one set of one exercise
export const formatCell = (per, setNo, exNo, get) => {
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
export const resultColumns = (block) => {
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
export const orphanEntries = (block, all) => {
  const known = new Set(fieldKeys(block));
  return Object.entries(all || {}).filter(
    ([k, v]) => !known.has(k) && String(v ?? "").trim(),
  );
};

// One line of text for the coach, e.g. "Squat: S1 90 kg · 5 reps / S2 100 kg · 5 reps · Comment: heavy"
export const describeResults = (block, get, all) => {
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
export const describeFields = (block) => {
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
