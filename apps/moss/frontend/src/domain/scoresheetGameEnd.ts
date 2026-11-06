// Shared rules for where the game ended. Mirrors the "Game end" section of
// assets/scoresheet_export_json_spec.md and backend/moss/services/export_facts.py.

// Returns the boundary the game ended early at, or null when the game ran to the
// last pair. Boundary N sits before pair N, so the valid range is 2..lastPairId;
// anything else (including the default "after the last pair") means not ended early.
export function resolveEndBoundary(endBoundary: number | null | undefined, pairIds: number[]): number | null {
  if (typeof endBoundary !== "number" || !Number.isInteger(endBoundary)) return null;
  if (!pairIds.length) return null;
  const lastPairId = Math.max(...pairIds);
  if (endBoundary < 2 || endBoundary > lastPairId) return null;
  return endBoundary;
}

// The boundary after the last pair, where END sits by default.
export function finalBoundary(pairIds: number[]): number {
  return pairIds.length ? Math.max(...pairIds) + 1 : 1;
}

// Ending "before" a pair means it was not read; ending "after" means it was the last pair heard.
export type EarlyEndTiming = "before" | "after";

export function endBoundaryForPair(pairId: number, timing: EarlyEndTiming): number {
  return timing === "before" ? pairId : pairId + 1;
}

// Whether END at this boundary would end the game early. Before the first pair is not a valid
// boundary, and after the last pair is where END already sits by default.
export function isEarlyEndBoundary(boundaryBeforeQuestion: number, pairIds: number[]): boolean {
  return resolveEndBoundary(boundaryBeforeQuestion, pairIds) !== null;
}

export function isPairAfterEnd(pairId: number, resolvedEndBoundary: number | null): boolean {
  return resolvedEndBoundary !== null && pairId >= resolvedEndBoundary;
}

// Index (into pairs sorted by id) of the last pair that was heard.
export function lastHeardPairIndex(sortedPairIds: number[], resolvedEndBoundary: number | null): number {
  if (resolvedEndBoundary === null) return sortedPairIds.length - 1;
  let last = -1;
  for (let i = 0; i < sortedPairIds.length; i++) {
    if (sortedPairIds[i] < resolvedEndBoundary) last = i;
  }
  return last;
}
