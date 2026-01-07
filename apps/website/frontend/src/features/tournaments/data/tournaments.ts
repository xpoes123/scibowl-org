import type { TournamentSummary } from "../types";

/**
 * Tournament data loader for NSB Arena.
 *
 * Each tournament is stored as a JSON file in the tournaments/ directory.
 * To add a new tournament:
 * 1. Create a new JSON file in tournaments/ with the next available ID (e.g., 26.json)
 * 2. Add the tournament data following the existing format
 * 3. Submit a PR with your changes
 *
 * Tournament IDs are simply incremental (1, 2, 3, ...).
 * The status field determines if the tournament is LIVE, UPCOMING, or FINISHED.
 *
 * Last updated: 1/6/2026
 */

// Import all tournament JSON files
import tournament1 from "./tournaments/1.json";
import tournament2 from "./tournaments/2.json";
import tournament3 from "./tournaments/3.json";
import tournament4 from "./tournaments/4.json";
import tournament5 from "./tournaments/5.json";
import tournament6 from "./tournaments/6.json";
import tournament7 from "./tournaments/7.json";
import tournament8 from "./tournaments/8.json";
import tournament9 from "./tournaments/9.json";
import tournament10 from "./tournaments/10.json";
import tournament11 from "./tournaments/11.json";
import tournament12 from "./tournaments/12.json";
import tournament13 from "./tournaments/13.json";
import tournament14 from "./tournaments/14.json";
import tournament15 from "./tournaments/15.json";
import tournament16 from "./tournaments/16.json";
import tournament17 from "./tournaments/17.json";
import tournament18 from "./tournaments/18.json";
import tournament19 from "./tournaments/19.json";
import tournament20 from "./tournaments/20.json";
import tournament21 from "./tournaments/21.json";
import tournament22 from "./tournaments/22.json";
import tournament23 from "./tournaments/23.json";
import tournament24 from "./tournaments/24.json";
import tournament25 from "./tournaments/25.json";

export const TOURNAMENTS: TournamentSummary[] = [
  tournament1,
  tournament2,
  tournament3,
  tournament4,
  tournament5,
  tournament6,
  tournament7,
  tournament8,
  tournament9,
  tournament10,
  tournament11,
  tournament12,
  tournament13,
  tournament14,
  tournament15,
  tournament16,
  tournament17,
  tournament18,
  tournament19,
  tournament20,
  tournament21,
  tournament22,
  tournament23,
  tournament24,
  tournament25,
] as TournamentSummary[];
