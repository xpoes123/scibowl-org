import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentStatsReportsIndex } from "../types";

type UseTournamentStatsReportsIndexResult = {
  data: TournamentStatsReportsIndex | null;
  loading: boolean;
  error: string | null;
};

export function useTournamentStatsReportsIndex(slug: string, enabled: boolean): UseTournamentStatsReportsIndexResult {
  const [data, setData] = useState<TournamentStatsReportsIndex | null>(null);
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
        const result = (await tournamentsAPI.getTournamentStatsReportsIndex(slug)) as TournamentStatsReportsIndex | null;
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load stats reports index");
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
