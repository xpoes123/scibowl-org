import { useEffect, useState } from "react";
import { getPacketSetBySlug } from "../data/packetSetDetails";
import type { PacketSet } from "../types";

type UsePacketSetResult = {
  data: PacketSet | null;
  loading: boolean;
  error: string | null;
};

export function usePacketSet(slug: string | undefined): UsePacketSetResult {
  const [data, setData] = useState<PacketSet | null>(null);
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
        const result = await getPacketSetBySlug(slug);
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load packet set");
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

