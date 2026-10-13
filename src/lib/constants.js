import { todayStr } from "./dates";

export const BLOCK_COLORS = { A: "#FF6B1A", B: "#FF9A4D", C: "#FFB87A", D: "#FFCFA0" };
export const RESULT_VARS = [
  "Time",
  "Rounds",
  "Reps",
  "Weight (kg)",
  "Distance (m)",
  "Comment",
];
export const BLOCK_TEMPLATES = {
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
export const templatePatch = (name) => ({
  description: BLOCK_TEMPLATES[name].description,
  variables: BLOCK_TEMPLATES[name].variables,
  sets: BLOCK_TEMPLATES[name].sets || 1,
});
export const EMPTY_BLOCK = () => ({
  name: "A",
  description: "",
  variables: ["Rounds", "Weight (kg)"],
});
export const EMPTY_WOD = () => ({
  id: Date.now(),
  title: "",
  sessionNumber: 1,
  blocks: [EMPTY_BLOCK()],
  date: todayStr(),
});
export const EMPTY_PERIOD = () => ({
  id: Date.now(),
  name: "",
  focus: "",
  startDate: todayStr(),
  durationWeeks: 8,
  workouts: [],
});
// Next free session number in a period (values that aren't numbers are ignored)
export const nextSessionNumber = (workouts) => {
  const nums = workouts.map((w) => w.sessionNumber).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) + 1 : 1;
};
export const DEFAULT_MEMBERS = [
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

export const DEMO_PERIOD = {
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
