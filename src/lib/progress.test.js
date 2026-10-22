import { describe, it, expect } from "vitest";
import {
  parseNum,
  exerciseEntries,
  entriesFromWorkouts,
  entriesFromClassResults,
  groupByExercise,
  summarize,
  METRICS,
} from "./progress";

const block = {
  name: "B",
  variables: ["Weight (kg)", "Reps", "Comment"],
  sets: 2,
  exercises: ["Squat", "Press"],
};

describe("progress", () => {
  it("parseNum accepts comma decimals and rejects junk", () => {
    expect(parseNum("82,5")).toBe(82.5);
    expect(parseNum("")).toBeNull();
    expect(parseNum(undefined)).toBeNull();
    expect(parseNum("abc")).toBeNull();
  });

  it("exerciseEntries reads sets per exercise and skips exercises with no data", () => {
    const res = {
      "Weight (kg)#1@1": "100",
      "Reps#1@1": "5",
      "Weight (kg)#2@1": "105",
      "Reps#2@1": "3",
    };
    const e = exerciseEntries(block, (k) => res[k]);
    expect(e).toEqual([
      {
        name: "Squat",
        sets: [
          { w: 100, r: 5 },
          { w: 105, r: 3 },
        ],
      },
    ]);
  });

  it("exerciseEntries is empty without named exercises or weight/reps", () => {
    expect(exerciseEntries({ variables: ["Weight (kg)"], sets: 3 }, () => "5")).toEqual([]);
    expect(exerciseEntries({ variables: ["Time"], exercises: ["Run"] }, () => "5")).toEqual([]);
  });

  it("entriesFromWorkouts attaches date and title", () => {
    const w = {
      date: "2026-10-01",
      title: "Lower",
      blocks: [block],
      results: { B: { "Weight (kg)#1@2": "40", "Reps#1@2": "8" } },
    };
    const e = entriesFromWorkouts([w, { date: "2026-10-02", blocks: [block] }]);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ name: "Press", date: "2026-10-01", session: "Lower" });
  });

  it("entriesFromClassResults picks only the given member", () => {
    const w = { id: 7, date: "2026-10-05", sessionNumber: 3, blocks: [block] };
    const docs = {
      7: {
        results: {
          "B|Anna": { "Weight (kg)#1@1": "60", "Reps#1@1": "10" },
          "B|Bo": { "Weight (kg)#1@1": "90", "Reps#1@1": "10" },
        },
      },
    };
    const e = entriesFromClassResults([w], docs, "Anna");
    expect(e).toHaveLength(1);
    expect(e[0].sets).toEqual([{ w: 60, r: 10 }]);
    expect(e[0].session).toBe("Session #3");
    expect(entriesFromClassResults([w], docs, "Nobody")).toEqual([]);
  });

  it("groupByExercise merges names case-insensitively, sorts by date and by count", () => {
    const g = groupByExercise([
      { name: "squat", date: "2026-10-02", sets: [] },
      { name: "Press", date: "2026-10-01", sets: [] },
      { name: "Squat", date: "2026-10-01", sets: [] },
    ]);
    expect(g.map((x) => x.key)).toEqual(["squat", "press"]);
    expect(g[0].items.map((i) => i.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(g[0].name).toBe("squat"); // newest spelling
  });

  it("metrics: top weight, estimated 1RM, volume, reps", () => {
    const sets = [
      { w: 100, r: 5 },
      { w: 110, r: 1 },
    ];
    expect(METRICS.top.calc(sets)).toBe(110);
    expect(METRICS.e1rm.calc(sets)).toBe(116.7); // 100 * (1 + 5/30)
    expect(METRICS.volume.calc(sets)).toBe(610);
    expect(METRICS.topReps.calc(sets)).toBe(5);
    expect(METRICS.reps.calc(sets)).toBe(6);
    expect(METRICS.top.calc([{ w: null, r: 5 }])).toBeNull();
  });

  it("summarize gives first/last/best/diff/pct and drops sessions without a value", () => {
    const items = [
      { date: "2026-10-01", session: "a", sets: [{ w: 100, r: 5 }] },
      { date: "2026-10-08", session: "b", sets: [{ w: null, r: 5 }] },
      { date: "2026-10-15", session: "c", sets: [{ w: 110, r: 5 }] },
    ];
    const s = summarize(items, "top");
    expect(s.pts).toHaveLength(2);
    expect(s).toMatchObject({ first: 100, last: 110, best: 110, diff: 10, pct: 10 });
    expect(summarize([{ date: "2026-10-01", session: "a", sets: [{ w: null, r: 5 }] }], "top")).toBeNull();
  });
});
