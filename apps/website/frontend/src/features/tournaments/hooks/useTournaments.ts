import { useMemo } from "react";
import { mockTournaments } from "../mock/mockTournaments";
import type { TournamentSummary } from "../types";

type UseTournamentsResult = {
  tournaments: TournamentSummary[];
  loading: boolean;
  error: string | null;
};

export function useTournaments(): UseTournamentsResult {
  // TODO(API): Replace mock data with a real API call (e.g. `tournamentsAPI.getTournaments()`),
  // keeping the return shape stable so pages/components remain unchanged.
  const tournaments = useMemo(() => mockTournaments, []);

  return {
    tournaments,
    loading: false,
    error: null,
  };
}

