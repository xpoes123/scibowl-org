import type { TournamentSummary } from "../types";
import tournamentsData from "./tournaments.json";

/**
 * Tournament data loader for NSB Arena.
 *
 * All tournaments are stored in a single tournaments.json file.
 * To add a new tournament:
 * 1. Add the tournament data to tournaments.json following the existing format
 * 2. Submit a PR with your changes
 *
 * The status field determines if the tournament is LIVE, UPCOMING, or FINISHED.
 *
 * Last updated: 1/8/2026
 */

export const TOURNAMENTS: TournamentSummary[] = tournamentsData as TournamentSummary[];
