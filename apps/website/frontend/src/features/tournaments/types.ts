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

