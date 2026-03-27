import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentSummary } from "../types";

type UseTournamentsResult = {
  tournaments: TournamentSummary[];
  loading: boolean;
  error: string | null;
};

/**
 * Hook to fetch the public tournament listing from the API.
 * Returns only PUBLISHED tournaments (filtered server-side).
 */
export function useTournaments(): UseTournamentsResult {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await tournamentsAPI.getPublicTournaments();
        if (!cancelled) setTournaments(data as TournamentSummary[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tournaments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { tournaments, loading, error };
}
