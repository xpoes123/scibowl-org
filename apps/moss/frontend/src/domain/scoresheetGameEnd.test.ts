import { describe, expect, it } from "vitest";
import { finalBoundary, isPairAfterEnd, lastHeardPairIndex, resolveEndBoundary } from "./scoresheetGameEnd";

const pairIds = [1, 2, 3, 4, 5];

describe("resolveEndBoundary", () => {
  it("accepts boundaries from 2 to the last pair id", () => {
    expect(resolveEndBoundary(2, pairIds)).toBe(2);
    expect(resolveEndBoundary(5, pairIds)).toBe(5);
  });

  it("treats anything else as not ended early", () => {
    for (const raw of [null, undefined, 1, 6, 99, 2.5]) {
      expect(resolveEndBoundary(raw, pairIds)).toBeNull();
    }
    expect(resolveEndBoundary(3, [])).toBeNull();
  });
});

describe("finalBoundary", () => {
  it("is the boundary after the last pair", () => {
    expect(finalBoundary(pairIds)).toBe(6);
    expect(finalBoundary([])).toBe(1);
  });
});

describe("isPairAfterEnd", () => {
  it("includes the pair right after the boundary", () => {
    expect(isPairAfterEnd(3, 3)).toBe(true);
    expect(isPairAfterEnd(2, 3)).toBe(false);
  });

  it("is never true when the game was not ended early", () => {
    expect(isPairAfterEnd(5, null)).toBe(false);
  });
});

describe("lastHeardPairIndex", () => {
  it("is the last pair when the game was not ended early", () => {
    expect(lastHeardPairIndex(pairIds, null)).toBe(4);
  });

  it("is the pair before the boundary", () => {
    expect(lastHeardPairIndex(pairIds, 3)).toBe(1);
    expect(lastHeardPairIndex(pairIds, 2)).toBe(0);
  });
});
