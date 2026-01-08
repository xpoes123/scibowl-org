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
 * Get tournament detail by slug.
 * Returns the tournament data from the JSON files.
 */
export async function getTournamentById(slug: string): Promise<TournamentDetail> {
  // Simulate async data fetching (for future API compatibility)
  await new Promise((resolve) => setTimeout(resolve, 100));

  const tournament = TOURNAMENTS.find((t) => t.slug === slug);

  if (!tournament) {
    throw new Error(`Tournament with slug "${slug}" not found`);
  }

  // Cast to TournamentDetail - JSON files contain full tournament data
  return tournament as TournamentDetail;
}
