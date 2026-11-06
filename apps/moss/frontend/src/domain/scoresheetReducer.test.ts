import { describe, expect, it } from "vitest";
import type { ScoresheetEvent, ScoresheetEventType } from "./scoresheetEvents";
import { initialScoresheetState, reduceScoresheetEvents, type ScoresheetState } from "./scoresheetReducer";

function ev(seq: number, type: ScoresheetEventType, payload: object = {}): ScoresheetEvent {
  return { id: `ev_${seq}`, type, payload: payload as ScoresheetEvent["payload"], seq };
}

describe("game end", () => {
  it("starts with no end", () => {
    expect(reduceScoresheetEvents([]).endBoundary).toBeNull();
  });

  it("records end.set and lets the last one win", () => {
    const state = reduceScoresheetEvents([
      ev(1, "end.set", { boundary_before_question: 3 }),
      ev(2, "end.set", { boundary_before_question: 4 }),
    ]);
    expect(state.endBoundary).toBe(4);
  });

  it("clears the end on end.cleared", () => {
    const state = reduceScoresheetEvents([
      ev(1, "end.set", { boundary_before_question: 3 }),
      ev(2, "end.cleared"),
    ]);
    expect(state.endBoundary).toBeNull();
  });

  it("treats a non-integer boundary as no end, like the backend", () => {
    const state = reduceScoresheetEvents([
      ev(1, "end.set", { boundary_before_question: 3 }),
      ev(2, "end.set", { boundary_before_question: "4" }),
    ]);
    expect(state.endBoundary).toBeNull();
  });

  it("is independent of HALFTIME/BREAK markers on the same boundary", () => {
    const state = reduceScoresheetEvents([
      ev(1, "marker.set", { boundary_before_question: 3, kind: "HALFTIME" }),
      ev(2, "end.set", { boundary_before_question: 3 }),
      ev(3, "marker.removed", { boundary_before_question: 3 }),
    ]);
    expect(state.endBoundary).toBe(3);
    expect(state.markers).toEqual({});
  });

  it("carries the end over from a base state", () => {
    const base = reduceScoresheetEvents([ev(1, "end.set", { boundary_before_question: 2 })]);
    expect(reduceScoresheetEvents([], base).endBoundary).toBe(2);
  });

  it("accepts a base state from an older window that has no endBoundary", () => {
    const { endBoundary: _omitted, ...old } = initialScoresheetState();
    void _omitted;
    expect(reduceScoresheetEvents([], old as ScoresheetState).endBoundary).toBeNull();
  });

  it("does not mutate the base state", () => {
    const base = initialScoresheetState();
    reduceScoresheetEvents([ev(1, "end.set", { boundary_before_question: 2 })], base);
    expect(base.endBoundary).toBeNull();
  });
});
