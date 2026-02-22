import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentStandingsResponse } from "../types";

type UseTournamentStandingsResult = {
  data: TournamentStandingsResponse | null;
  loading: boolean;
  error: string | null;
};

export function useTournamentStandings(slug: string, enabled: boolean): UseTournamentStandingsResult {
  const [data, setData] = useState<TournamentStandingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = (await tournamentsAPI.getTournamentStandings(slug)) as TournamentStandingsResponse | null;
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load standings");
        setData(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug]);

  return { data, loading, error };
}

