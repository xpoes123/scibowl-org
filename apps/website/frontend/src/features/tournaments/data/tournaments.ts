/**
 * Tournament data is now served from the database via the API.
 *
 * - Public listing:  GET /api/tournaments/        → useTournaments hook
 * - Tournament detail: GET /api/tournaments/:slug/ → getTournamentById (tournamentDetails.ts)
 *
 * tournaments.json is retained as a seed reference for load_tournaments_json.
 * It is no longer imported at runtime.
 */
