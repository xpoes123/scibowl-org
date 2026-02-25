export type ScoreboardDisplayView = "default" | "large";

export type ScoreboardRowAdvanceMode = "follow_moderator" | "frozen" | "most_recent";

const DISPLAY_VIEW_STORAGE_KEY = "moss_scoreboard_display_view";
const ROW_ADVANCE_MODE_STORAGE_KEY = "moss_scoreboard_row_advance_mode";

export function loadScoreboardDisplayView(): ScoreboardDisplayView {
  try {
    const raw = localStorage.getItem(DISPLAY_VIEW_STORAGE_KEY);
    return raw === "large" ? "large" : "default";
  } catch {
    return "default";
  }
}

export function saveScoreboardDisplayView(view: ScoreboardDisplayView): void {
  try {
    localStorage.setItem(DISPLAY_VIEW_STORAGE_KEY, view);
  } catch {
    // ignore
  }
}

export function loadScoreboardRowAdvanceMode(): ScoreboardRowAdvanceMode {
  try {
    const raw = localStorage.getItem(ROW_ADVANCE_MODE_STORAGE_KEY);
    if (raw === "follow_moderator" || raw === "frozen" || raw === "most_recent") return raw;
  } catch {
    // ignore
  }

  return "follow_moderator";
}

export function saveScoreboardRowAdvanceMode(mode: ScoreboardRowAdvanceMode): void {
  try {
    localStorage.setItem(ROW_ADVANCE_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

