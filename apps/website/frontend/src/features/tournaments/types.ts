// Tournament Division/Level
export type TournamentDivision = "MS" | "HS" | "OPEN";

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
  dates: TournamentDates;
  divisions: TournamentDivision[];
  location?: TournamentLocation | null;
  updated_at?: string;
}

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
