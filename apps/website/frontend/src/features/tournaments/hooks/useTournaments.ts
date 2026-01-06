import { useMemo } from "react";
import { TOURNAMENTS } from "../data/tournaments";
import type { TournamentSummary } from "../types";

type UseTournamentsResult = {
  tournaments: TournamentSummary[];
  loading: boolean;
  error: string | null;
};

/**
 * Hook to access the hardcoded tournament listings.
 * Tournaments are managed via PR (see data/tournaments.ts).
 */
export function useTournaments(): UseTournamentsResult {
  const tournaments = useMemo(() => TOURNAMENTS, []);

  return {
    tournaments,
    loading: false,
    error: null,
  };
}

