import { describe, it, expect } from "vitest";
import {
  fieldKeys,
  fieldList,
  describeResults,
  cleanBlock,
} from "./resultFields";

describe("resultFields", () => {
  it("fieldKeys: weight/reps per set (3 sets) + comment once", () => {
    const block = { variables: ["Weight (kg)", "Reps", "Comment"], sets: 3 };
    expect(fieldKeys(block)).toEqual([
      "Weight (kg)#1",
      "Reps#1",
      "Weight (kg)#2",
      "Reps#2",
      "Weight (kg)#3",
      "Reps#3",
      "Comment",
    ]);
  });

  it("fieldList: 3 exercises x 4 sets x weight/reps + comment = 25 fields, first is Weight (kg)#1@1", () => {
    const block = {
      variables: ["Weight (kg)", "Reps", "Comment"],
      sets: 4,
      exercises: ["Bulgarian Split Squat", "Single Leg RDL", "Pallof press"],
    };
    const list = fieldList(block);
    expect(list).toHaveLength(25);
    expect(list[0].key).toBe("Weight (kg)#1@1");
  });

  it("fieldKeys: old block without sets keeps the plain variable names", () => {
    expect(fieldKeys({ variables: ["Rounds", "Weight (kg)"] })).toEqual([
      "Rounds",
      "Weight (kg)",
    ]);
  });

  it("fieldKeys: exercises without sets are logged once per exercise", () => {
    const block = {
      variables: ["Weight (kg)", "Reps"],
      exercises: ["Squat", "Press"],
    };
    expect(fieldKeys(block)).toEqual([
      "Weight (kg)@1",
      "Reps@1",
      "Weight (kg)@2",
      "Reps@2",
    ]);
  });

  it("describeResults: values logged under an earlier setup are still shown", () => {
    const block = { variables: ["Weight (kg)", "Reps", "Comment"], sets: 5 };
    const stored = { "Weight (kg)": "10", Reps: "10", Comment: "yes" };
    expect(describeResults(block, (k) => stored[k], stored)).toBe(
      "Comment: yes · Logged under an earlier setup: Weight (kg) 10, Reps 10",
    );
  });

  it("cleanBlock: trims exercise names and drops empty ones", () => {
    expect(cleanBlock({ exercises: ["  Squat ", "", "Press"] }).exercises).toEqual([
      "Squat",
      "Press",
    ]);
  });
});
