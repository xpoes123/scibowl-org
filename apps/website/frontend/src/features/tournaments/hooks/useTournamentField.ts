import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentFieldResponse } from "../types";

type UseTournamentFieldResult = {
  data: TournamentFieldResponse | null;
  loading: boolean;
  error: string | null;
};

export function useTournamentField(slug: string): UseTournamentFieldResult {
  const [data, setData] = useState<TournamentFieldResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = (await tournamentsAPI.getTournamentField(slug)) as TournamentFieldResponse | null;
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load field");
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
  }, [slug]);

  return { data, loading, error };
}

