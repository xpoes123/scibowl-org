// Client for /api/tournament-packets (apps/moss/frontend/api/tournament-packets.ts).

const ENDPOINT = "/api/tournament-packets";
const NOT_DEPLOYED_MESSAGE = "Tournament packets are only available on deployed MoSS.";

export type TournamentPacketSummary = {
  id: string;
  name: string;
};

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  // Without the serverless function (e.g. `npm run dev`), the SPA fallback or a bare 404 comes back instead.
  if (!contentType.includes("application/json")) throw new Error(NOT_DEPLOYED_MESSAGE);
  const text = await response.text();
  if (!response.ok) {
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      // Fall through to the generic message.
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return JSON.parse(text);
}

export async function fetchTournamentPacketSlugs(): Promise<string[]> {
  const response = await fetch(ENDPOINT, { headers: { Accept: "application/json" } });
  const obj = (await readJsonResponse(response)) as { slugs?: unknown };
  if (!Array.isArray(obj.slugs)) throw new Error("Packet index has unexpected format.");
  return obj.slugs.filter((s): s is string => typeof s === "string");
}

export async function fetchTournamentPacketList(slug: string): Promise<TournamentPacketSummary[]> {
  const response = await fetch(`${ENDPOINT}?slug=${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
  });
  const obj = (await readJsonResponse(response)) as { packets?: unknown };
  if (!Array.isArray(obj.packets)) throw new Error("Packet list has unexpected format.");
  return obj.packets
    .filter((p): p is TournamentPacketSummary => {
      const rec = p as Partial<TournamentPacketSummary> | null;
      return !!rec && typeof rec.id === "string" && typeof rec.name === "string";
    })
    .map((p) => ({ id: p.id, name: p.name }));
}

// Resolves to the raw packet JSON text; throws with the server's message (e.g. "Incorrect password.").
export async function unlockTournamentPacket(slug: string, packetId: string, password: string): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ slug, packet_id: packetId, password }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (response.ok && contentType.includes("application/json")) return response.text();
  await readJsonResponse(response);
  throw new Error(`Request failed (${response.status})`);
}
