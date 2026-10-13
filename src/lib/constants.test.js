import { describe, it, expect } from "vitest";
import { nextSessionNumber } from "./constants";

describe("nextSessionNumber", () => {
  it("ignores values that aren't numbers: [1, missing, 3] gives 4", () => {
    expect(
      nextSessionNumber([{ sessionNumber: 1 }, {}, { sessionNumber: 3 }]),
    ).toBe(4);
  });

  it("starts at 1 for an empty period", () => {
    expect(nextSessionNumber([])).toBe(1);
  });
});
