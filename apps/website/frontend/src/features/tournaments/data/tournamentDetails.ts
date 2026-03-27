import { tournamentsAPI } from "../../../core/api/api";
import type { TournamentDetail } from "../types";

/**
 * Fetch full tournament detail by slug from the API.
 */
export async function getTournamentById(slug: string): Promise<TournamentDetail> {
  return tournamentsAPI.getPublicTournament(slug) as Promise<TournamentDetail>;
}
