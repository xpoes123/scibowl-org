import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";

type UseTournamentStatsCsvResult = {
  rows: Array<Record<string, string>> | null;
  loading: boolean;
  error: string | null;
};

export function useTournamentStatsCsv(slug: string, enabled: boolean, statsPath?: string | null): UseTournamentStatsCsvResult {
  const [rows, setRows] = useState<Array<Record<string, string>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled || !statsPath) {
        setRows(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await tournamentsAPI.getTournamentStatsCsvObjects(slug, statsPath);
        if (cancelled) return;
        setRows(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load stats CSV");
        setRows(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, slug, statsPath]);

  return { rows, loading, error };
}

