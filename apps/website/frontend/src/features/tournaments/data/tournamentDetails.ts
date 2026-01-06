import type { TournamentDetail } from "../types";

/**
 * Hardcoded tournament detail data for NSB Arena.
 *
 * This contains the full tournament information shown on detail pages.
 * To add/update tournament details, edit this file and submit a PR.
 *
 * NOTE: Not all tournaments have full detail data yet.
 * Tournaments without details will show basic info from the listing.
 *
 * Last updated: 1/6/2026
 */
export const TOURNAMENT_DETAILS: Record<string, TournamentDetail> = {
  // === UPCOMING TOURNAMENTS ===
  "203": {
    id: "203",
    name: "Yale Science Bowl Invitational",
    status: "UPCOMING",
    levels: ["HS"],
    location_city: "New Haven",
    location_state: "CT",
    start_date: "2026-01-17",
    website_url: "https://yalesciencebowl.org/",
    contact_info: "Yale Undergraduate Science Bowl Team",
    logistics: "In-person at Yale University. Event details and updates will be posted on the website.",
    registration: {
      method: "FORM",
      instructions: "Registration is open and will be accepted on a first-come, first-served basis. Please have only one member/coach per team fill out the form. There is a soft cap of two teams per school.",
      url: "https://forms.gle/QFnxL6J6QWsPMtcv8",
      deadlines: [],
    },
    format: {
      summary: "Annual academic competition for middle and high school students",
      phases: [],
    },
    teams: [],
  },

  "210": {
    id: "210",
    name: "Stanford Science Bowl",
    status: "UPCOMING",
    levels: ["HS"],
    location_city: "Palo Alto",
    location_state: "CA",
    start_date: "2026-03-08",
    website_url: "https://stanfordsciencebowl.com",
    registration: {
      method: "WEBSITE",
      instructions: "Visit the website to register your team.",
      url: "https://stanfordsciencebowl.com/register",
      deadlines: [],
    },
    format: {
      summary: "Preliminary rounds followed by championship bracket",
      phases: [],
    },
    teams: [],
  },

  // === FINISHED TOURNAMENTS ===
  "301": {
    id: "301",
    name: "Berkeley Science Bowl",
    status: "FINISHED",
    levels: ["HS"],
    location_city: "Berkeley",
    location_state: "CA",
    start_date: "2025-12-06",
    end_date: "2025-12-06",
    registration: {
      method: "WEBSITE",
      instructions: "Registration is closed.",
      deadlines: [],
    },
    format: {
      summary: "Round robin preliminary rounds followed by playoff bracket",
      phases: [],
    },
    teams: [],
  },

  "302": {
    id: "302",
    name: "Rice Science Bowl",
    status: "FINISHED",
    levels: ["HS"],
    location_city: "Houston",
    location_state: "TX",
    start_date: "2025-12-06",
    end_date: "2025-12-06",
    registration: {
      method: "WEBSITE",
      instructions: "Registration is closed.",
      deadlines: [],
    },
    format: {
      summary: "Tournament format details to be added",
      phases: [],
    },
    teams: [],
  },
};

/**
 * Get tournament detail by ID.
 * Returns the full detail if available, or generates basic detail from listing data.
 */
export async function getTournamentById(id: string): Promise<TournamentDetail> {
  // Simulate async data fetching (for future API compatibility)
  await new Promise((resolve) => setTimeout(resolve, 100));

  const detail = TOURNAMENT_DETAILS[id];

  if (!detail) {
    throw new Error(`Tournament with id "${id}" not found`);
  }

  return detail;
}
