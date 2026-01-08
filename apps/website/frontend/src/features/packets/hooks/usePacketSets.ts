import { useMemo } from "react";
import { PACKET_SETS } from "../data/packetSets";
import type { PacketSet } from "../types";

type UsePacketSetsResult = {
  packetSets: PacketSet[];
  loading: boolean;
  error: string | null;
};

/**
 * Hook to access the hardcoded packet set listings.
 * Packet sets are managed via PR (see data/sample-packets.json).
 */
export function usePacketSets(): UsePacketSetsResult {
  const packetSets = useMemo(() => PACKET_SETS, []);

  return {
    packetSets,
    loading: false,
    error: null,
  };
}
