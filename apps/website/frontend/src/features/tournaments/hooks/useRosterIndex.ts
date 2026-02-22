import { useEffect, useState } from "react";
import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentRosterIndexResponse } from "../types";

type UseRosterIndexResult = {
  slugs: Set<string> | null;
  loading: boolean;
  error: string | null;
};

export function useRosterIndex(): UseRosterIndexResult {
  const [slugs, setSlugs] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = (await tournamentsAPI.getRosterIndex()) as TournamentRosterIndexResponse | null;
        if (cancelled) return;
        setSlugs(new Set(result?.slugs ?? []));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load roster index");
        setSlugs(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { slugs, loading, error };
}

