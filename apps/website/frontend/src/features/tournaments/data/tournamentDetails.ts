import type { TournamentDetail } from "../types";
import { TOURNAMENTS } from "./tournaments";

/**
 * Tournament detail data loader for NSB Arena.
 *
 * Tournament details are loaded from the same JSON files in tournaments/ directory.
 * Each JSON file can contain both summary data (shown in lists) and detailed data
 * (shown on detail pages).
 *
 * To add/update tournament details, edit the JSON file in tournaments/ and submit a PR.
 *
 * Tournament IDs are simply incremental (1, 2, 3, ...).
 * The status field determines if the tournament is LIVE, UPCOMING, or FINISHED.
 *
 * Last updated: 1/6/2026
 */

/**
 * Get tournament detail by ID.
 * Returns the tournament data from the JSON files.
 */
export async function getTournamentById(id: string): Promise<TournamentDetail> {
  // Simulate async data fetching (for future API compatibility)
  await new Promise((resolve) => setTimeout(resolve, 100));

  const tournament = TOURNAMENTS.find((t) => t.id === id);

  if (!tournament) {
    throw new Error(`Tournament with id "${id}" not found`);
  }

  // Cast to TournamentDetail - JSON files may have additional detail fields
  // that aren't in TournamentSummary but are in TournamentDetail
  const detail: TournamentDetail = {
    ...tournament,
    levels: tournament.level, // Map level to levels for detail view
    teams: [],
    // Provide defaults for required fields if not present in JSON
    registration: (tournament as any).registration || {
      method: "OTHER" as const,
      instructions: "Registration information not available.",
      deadlines: [],
    },
    format: (tournament as any).format || {
      summary: "Tournament format details to be added",
      phases: [],
    },
  };

  return detail;
}
