import type { TournamentStatus, TournamentStatusParam } from "../types";

export function getStatusLabel(status: TournamentStatus): string {
  switch (status) {
    case "LIVE":
      return "Live";
    case "UPCOMING":
      return "Upcoming";
    case "FINISHED":
      return "Finished";
    default:
      return status;
  }
}

export function getStatusDotClass(status: TournamentStatus): string {
  switch (status) {
    case "LIVE":
      return "sbStatusDot sbStatusDotLive";
    case "UPCOMING":
      return "sbStatusDot sbStatusDotUpcoming";
    case "FINISHED":
      return "sbStatusDot sbStatusDotFinished";
    default:
      return "sbStatusDot";
  }
}

export function getStatusQueryParam(status: TournamentStatus): TournamentStatusParam {
  switch (status) {
    case "LIVE":
      return "live";
    case "UPCOMING":
      return "upcoming";
    case "FINISHED":
      return "finished";
    default:
      return "upcoming";
  }
}

export function parseStatusQueryParam(value: string | null): TournamentStatusParam | "all" {
  if (!value) return "all";
  const normalized = value.trim().toLowerCase();
  if (normalized === "live" || normalized === "upcoming" || normalized === "finished") return normalized;
  return "all";
}

