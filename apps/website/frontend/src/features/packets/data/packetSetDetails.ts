import type { PacketSet } from "../types";
import { PACKET_SETS } from "./packetSets";

export async function getPacketSetBySlug(slug: string): Promise<PacketSet> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const packetSet = PACKET_SETS.find((set) => set.slug === slug);
  if (!packetSet) {
    throw new Error(`Packet set with slug "${slug}" not found`);
  }

  return packetSet;
}

