import { useEffect, useState } from "react";
import { getTournamentById } from "../mock/mockTournamentDetail";
import type { TournamentDetail } from "../types";

type UseTournamentResult = {
  data: TournamentDetail | null;
  loading: boolean;
  error: string | null;
};

export function useTournament(tournamentId: string | undefined): UseTournamentResult {
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!tournamentId) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await getTournamentById(tournamentId);
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
  }, [tournamentId]);

  return { data, loading, error };
}

