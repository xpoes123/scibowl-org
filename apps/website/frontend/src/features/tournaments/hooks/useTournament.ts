import { useEffect, useState } from "react";
import { getTournamentById } from "../data/tournamentDetails";
import type { TournamentDetail } from "../types";

type UseTournamentResult = {
  data: TournamentDetail | null;
  loading: boolean;
  error: string | null;
};

export function useTournament(slug: string | undefined): UseTournamentResult {
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!slug) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await getTournamentById(slug);
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tournament");
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

