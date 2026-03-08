import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentStatsManifest } from "../types";

type UseTournamentStatsManifestResult = {
  data: TournamentStatsManifest | null;
  loading: boolean;
  error: string | null;
};

export function useTournamentStatsManifest(
  slug: string,
  enabled: boolean,
  manifestPath?: string | null,
): UseTournamentStatsManifestResult {
  const [data, setData] = useState<TournamentStatsManifest | null>(null);
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
        const result = (await tournamentsAPI.getTournamentStatsManifest(slug, manifestPath)) as TournamentStatsManifest | null;
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load stats manifest");
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
  }, [enabled, manifestPath, slug]);

  return { data, loading, error };
}

