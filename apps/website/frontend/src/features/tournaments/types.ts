// Tournament Division/Level
export type TournamentDivision = "MS" | "HS" | "OPEN" | "UG";

// Publication Status
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// Tournament Lifecycle Status (for display purposes)
export type TournamentStatus = "LIVE" | "UPCOMING" | "FINISHED";
export type TournamentStatusParam = "live" | "upcoming" | "finished";

// Tournament Mode
export type TournamentMode = "IN_PERSON" | "ONLINE";

// Contact Type
export type ContactType = "EMAIL" | "DISCORD" | "PHONE" | "OTHER";

// Link Type
export type LinkType = "WEBSITE" | "RESULTS" | "PACKETS" | "STATS" | "OTHER";

// Location
export interface TournamentLocation {
  city: string;
  state: string; // 2-letter state code
  address?: string;
}

// Dates
export interface TournamentDates {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (same as start for single-day)
}

// Notes
export interface TournamentNotes {
  logistics?: string;
  writing_team?: string;
}

// Format
export interface TournamentFormat {
  summary: string;
  rounds_guaranteed?: number;
}

// Contact
export interface TournamentContact {
  type: ContactType;
  value: string;
  label?: string;
}

// Registration
export interface TournamentRegistration {
  method: "FORM" | "EMAIL" | "WEBSITE" | "OTHER";
  instructions: string;
  url?: string;
  cost?: string;
  deadlines: Array<{ label: string; date: string }>;
}

// Link
export interface TournamentLink {
  type: LinkType;
  url: string;
  label: string;
}

// Main Tournament Interface
export interface Tournament {
  slug: string;
  name: string;
  status: PublicationStatus;
  mode: TournamentMode;
  timezone: string; // IANA timezone string
  dates: TournamentDates;
  divisions: TournamentDivision[];
  location?: TournamentLocation | null; // Optional for online tournaments
  difficulty?: string;
  notes?: TournamentNotes;
  format: TournamentFormat;
  contacts?: TournamentContact[];
  registration?: TournamentRegistration;
  links?: TournamentLink[];
  updated_at?: string; // ISO datetime
}

// Summary for tournament listing (lighter weight)
export interface TournamentSummary {
  slug: string;
  name: string;
  status: PublicationStatus;
  mode: TournamentMode;
  timezone: string; // IANA timezone string (needed for status calculation)
  dates: TournamentDates;
  divisions: TournamentDivision[];
  location?: TournamentLocation | null;
  updated_at?: string;
}

export type TeamStandingsRow = {
  rank: number;
  team_id: number;
  name: string;
  wins?: number;
  losses?: number;
  games_played?: number;
  points_per_game: number;
  "4s": number;
  "-4s": number;
  "0s": number;
  tossups_heard: number;
  bonuses_heard: number;
  bonus_points: number;
  points_per_bonus: number;
};

export type IndividualStandingsRow = {
  rank: number;
  player_id: number;
  name: string;
  team: string;
  games_played: number;
  "4s": number;
  "-4s": number;
  "0s": number;
  tossups_heard: number;
  tossup_points: number;
  points_per_game: number;
};

export type TournamentStandingsResponse = {
  tournament: { id: number; slug: string | null; name: string };
  team_standings: TeamStandingsRow[];
  individual_standings: IndividualStandingsRow[];
};

export type TournamentStatsManifest = {
  schema_version: number;
  generated_at: string;
  tournament: { slug: string; name: string };
  report?: { key: string; label: string };
  rounds?: {
    mode: string;
    rounds: Array<{
      round_number: number;
      name: string;
      packet_name: string;
      game_count: number;
    }>;
  };
  datasets?: Partial<{
    teams: string;
    players: string;
    rounds: string;
    games: string;
    game_teams: string;
    game_players: string;
    game_teams_by_category: string;
    game_players_by_category: string;
    buzzes: string;
    questions_meta: string;
    games_buzz: string;
  }>;
  views: {
    team_standings: string;
    individual_standings: string;
    category_standings?: Array<{
      category: string;
      key: string;
      team_standings: string;
      individual_standings: string;
    }>;
    buzzpoints?: {
      index: string;
      buzzes: string;
      questions: string;
      games: string;
      teams: string;
      players: string;
    };
  };
};

export type TournamentStatsReportsIndex = {
  schema_version: number;
  default_report_key: string;
  reports: Array<{
    key: string;
    label: string;
    manifest_path: string;
  }>;
};

// Alias for backwards compatibility
export type TournamentDetail = Tournament;

// Legacy types (to be removed after full migration)
export type TournamentLevel = TournamentDivision;

export interface TeamRosterMember {
  name: string;
  grade?: number;
  role?: "Captain" | "Player" | "Coach";
}

export interface TournamentTeam {
  id: string;
  team_name: string;
  school_name?: string;
  city?: string;
  state?: string;
  level: TournamentDivision;
  status?: "CONFIRMED" | "WAITLIST" | "DROPPED";
  roster?: TeamRosterMember[];
}

export interface TournamentFieldTeam {
  name: string;
  players: string[];
}

export interface TournamentFieldResponse {
  format: "moss_field_roster";
  version: 1;
  tournament?: { slug?: string; name?: string };
  teams: TournamentFieldTeam[];
}

export interface TournamentRosterIndexResponse {
  format: "moss_roster_index";
  version: 1;
  slugs: string[];
}
