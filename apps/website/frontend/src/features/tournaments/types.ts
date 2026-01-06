export type TournamentLevel = "MS" | "HS";

export type TournamentStatus = "LIVE" | "UPCOMING" | "FINISHED";

export type TournamentStatusParam = "live" | "upcoming" | "finished";

export interface TournamentSummary {
  id: string;
  name: string;
  location_city: string;
  location_state: string;
  start_date: string; // ISO (YYYY-MM-DD recommended)
  end_date?: string; // ISO
  level: TournamentLevel[]; // display as pills
  status: TournamentStatus;
  updated_at?: string; // ISO
  is_published?: boolean;
}

export interface RegistrationInfo {
  method: "FORM" | "EMAIL" | "WEBSITE" | "OTHER";
  instructions: string;
  url?: string;
  deadlines: Array<{ label: string; date: string }>;
  cost?: string;
}

export interface TournamentFormatPhase {
  name: string;
  description: string;
}

export interface TournamentFormat {
  summary: string;
  phases: TournamentFormatPhase[];
  field_limit?: number;
  rounds?: number;
}

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
  level: TournamentLevel;
  status?: "CONFIRMED" | "WAITLIST" | "DROPPED";
  roster?: TeamRosterMember[];
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: TournamentStatus;
  levels: TournamentLevel[];
  location_city: string;
  location_state: string;
  start_date: string;
  end_date?: string;
  difficulty?: string;
  writing_team?: string;
  website_url?: string;
  contact_info?: string;
  logistics?: string;
  registration: RegistrationInfo;
  format: TournamentFormat;
  field_limit?: number;
  teams: TournamentTeam[];
  updated_at?: string;
}
