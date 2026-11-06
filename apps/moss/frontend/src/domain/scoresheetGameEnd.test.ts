import { describe, expect, it } from "vitest";
import {
  endBoundaryForPair,
  finalBoundary,
  isEarlyEndBoundary,
  isPairAfterEnd,
  lastHeardPairIndex,
  resolveEndBoundary,
} from "./scoresheetGameEnd";

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

describe("endBoundaryForPair", () => {
  it("puts END before the pair when it is not read, and after it when it is", () => {
    expect(endBoundaryForPair(3, "before")).toBe(3);
    expect(endBoundaryForPair(3, "after")).toBe(4);
  });
});

describe("isEarlyEndBoundary", () => {
  it("rejects ending before the first pair and after the last pair", () => {
    expect(isEarlyEndBoundary(endBoundaryForPair(1, "before"), pairIds)).toBe(false);
    expect(isEarlyEndBoundary(endBoundaryForPair(5, "after"), pairIds)).toBe(false);
  });

  it("accepts ending before the last pair or after the first", () => {
    expect(isEarlyEndBoundary(endBoundaryForPair(5, "before"), pairIds)).toBe(true);
    expect(isEarlyEndBoundary(endBoundaryForPair(1, "after"), pairIds)).toBe(true);
  });
});
