import { useMemo } from "react";
import { formatPacketOrRoundLabel } from "./statsText";

type ScoreboardViewProps = {
  games: Array<Record<string, string>> | null;
  gameTeams: Array<Record<string, string>> | null;
  gamePlayers: Array<Record<string, string>> | null;
  rounds: Array<Record<string, string>> | null;
  roundValue: string;
  onRoundChange: (value: string) => void;
};

function toIntOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function toInt(raw: string | undefined): number {
  return toIntOrNull(raw) ?? 0;
}

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits);
}

function DataTable({
  headers,
  rows,
}: {
  headers: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, string | number>>;
}) {
  return (
    <div className="sbDataTableWrap">
      <table className="sbDataTable">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h.key} className={h.numeric ? "sbNum" : undefined}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {headers.map((h) => (
                <td key={h.key} className={h.numeric ? "sbNum" : undefined}>
                  {row[h.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreboardView({ games, gameTeams, gamePlayers, rounds, roundValue, onRoundChange }: ScoreboardViewProps) {
  const parsedRounds = useMemo(() => {
    const list = (rounds ?? []).map((r) => {
      const roundNumber = toIntOrNull(r.round_number);
      return {
        round_number: roundNumber,
        round_name: r.round_name ?? "",
        packet_name: r.packet_name ?? "",
      };
    });
    return list.filter((r) => r.round_number !== null).sort((a, b) => (a.round_number ?? 0) - (b.round_number ?? 0));
  }, [rounds]);

  const parsedGames = useMemo(() => {
    return (games ?? []).map((g) => ({
      game_id: toInt(g.game_id),
      round_number: toIntOrNull(g.round_number),
      round_name: g.round_name ?? "",
      round_packet_name: g.round_packet_name ?? "",
      packet_name: g.packet_name ?? "",
      packet_year: toIntOrNull(g.packet_year),
      pairs_played: toIntOrNull(g.pairs_played),
    }));
  }, [games]);

  const hasUnassigned = useMemo(() => parsedGames.some((g) => g.round_number === null), [parsedGames]);

  const roundsByNumber = useMemo(() => {
    const map = new Map<number, { round_name: string; packet_name: string }>();
    for (const r of parsedRounds) {
      if (r.round_number === null) continue;
      map.set(r.round_number, { round_name: r.round_name, packet_name: r.packet_name });
    }
    return map;
  }, [parsedRounds]);

  const gameTeamsByGameId = useMemo(() => {
    const map = new Map<number, Array<Record<string, string>>>();
    for (const row of gameTeams ?? []) {
      const gameId = toIntOrNull(row.game_id);
      if (gameId === null) continue;
      const existing = map.get(gameId) ?? [];
      existing.push(row);
      map.set(gameId, existing);
    }
    for (const [gameId, rows] of map.entries()) {
      rows.sort((a, b) => toInt(a.slot) - toInt(b.slot));
      map.set(gameId, rows);
    }
    return map;
  }, [gameTeams]);

  const gamePlayersByGameIdThenTeamId = useMemo(() => {
    const map = new Map<number, Map<number, Array<Record<string, string>>>>();
    for (const row of gamePlayers ?? []) {
      const gameId = toIntOrNull(row.game_id);
      const teamId = toIntOrNull(row.team_id);
      if (gameId === null || teamId === null) continue;
      const byTeam = map.get(gameId) ?? new Map<number, Array<Record<string, string>>>();
      const players = byTeam.get(teamId) ?? [];
      players.push(row);
      byTeam.set(teamId, players);
      map.set(gameId, byTeam);
    }
    for (const byTeam of map.values()) {
      for (const [teamId, players] of byTeam.entries()) {
        players.sort((a, b) => {
          const ptsDiff = toInt(b.tossup_points) - toInt(a.tossup_points);
          if (ptsDiff !== 0) return ptsDiff;
          return (a.player_name ?? "").localeCompare(b.player_name ?? "");
        });
        byTeam.set(teamId, players);
      }
    }
    return map;
  }, [gamePlayers]);

  const filteredGames = useMemo(() => {
    if (roundValue === "all") return parsedGames;
    if (roundValue === "_unassigned") return parsedGames.filter((g) => g.round_number === null);

    const selected = Number.parseInt(roundValue, 10);
    if (!Number.isFinite(selected)) return parsedGames;
    return parsedGames.filter((g) => g.round_number === selected);
  }, [parsedGames, roundValue]);

  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      const aR = a.round_number ?? 999999;
      const bR = b.round_number ?? 999999;
      if (aR !== bR) return aR - bR;
      return a.game_id - b.game_id;
    });
  }, [filteredGames]);

  const roundSelectOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [{ value: "all", label: "All Rounds" }];
    for (const r of parsedRounds) {
      if (r.round_number === null) continue;
      opts.push({
        value: String(r.round_number),
        label: formatPacketOrRoundLabel(r.round_number, r.round_name, r.packet_name),
      });
    }
    if (hasUnassigned) opts.push({ value: "_unassigned", label: "Unassigned" });
    return opts;
  }, [hasUnassigned, parsedRounds]);

  return (
    <div className="sbTabStack">
      <div className="sbListingControls">
        <div className="sbField" style={{ flex: "0 1 340px", minWidth: "240px" }}>
          <select id="scoreboard-round" aria-label="Round" className="sbSelect" value={roundValue} onChange={(e) => onRoundChange(e.target.value)}>
            {roundSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sortedGames.length === 0 ? (
        <p className="sbMuted m-0">No games found for this round.</p>
      ) : (
        <div className="sbTabStack">
          {sortedGames.map((g) => {
            const teams = gameTeamsByGameId.get(g.game_id) ?? [];
            const t1 = teams[0] ?? null;
            const t2 = teams[1] ?? null;

            const roundInfo = g.round_number ? roundsByNumber.get(g.round_number) : null;
            const roundLabel =
              g.round_number !== null
                ? formatPacketOrRoundLabel(
                    g.round_number,
                    (roundInfo?.round_name ?? g.round_name) || "",
                    (roundInfo?.packet_name ?? g.round_packet_name) || "",
                  )
                : "Unassigned";

            const gameTitleParts = [
              roundLabel,
              t1 && t2 ? `${t1.team_name} ${toInt(t1.score)} – ${toInt(t2.score)} ${t2.team_name}` : `Game ${g.game_id}`,
            ].filter(Boolean);

            const teamSummaryRows = teams.map((t) => {
              const bonusesHeard = toInt(t.bonuses_correct) + toInt(t.bonuses_incorrect) + toInt(t.bonuses_unheard);
              const bonusPoints = toInt(t.bonus_points);
              const ppb = bonusesHeard > 0 ? bonusPoints / bonusesHeard : 0;
              return {
                team: t.team_name ?? "",
                score: toInt(t.score),
                "4s": toInt(t.tossups_correct),
                "-4s": toInt(t.tossups_incorrect),
                bh: bonusesHeard,
                bpts: bonusPoints,
                ppb: formatNumber(ppb, 2),
              };
            });

            const playerTables = teams.map((t) => {
              const teamId = toIntOrNull(t.team_id);
              const byTeam = gamePlayersByGameIdThenTeamId.get(g.game_id) ?? null;
              const players = teamId !== null ? byTeam?.get(teamId) ?? [] : [];

              const rows = players.map((p) => ({
                player: p.player_name ?? "",
                tuh: toInt(p.pairs_heard),
                "4s": toInt(p.tossups_correct),
                "-4s": toInt(p.tossups_incorrect),
                tu_pts: toInt(p.tossup_points),
              }));

              return { teamName: t.team_name ?? "", rows };
            });

            return (
              <div key={g.game_id} className="sbTabStack">
                <h3 className="m-0 text-sm font-semibold">{gameTitleParts.join(" • ")}</h3>

                <div>
                  <div className="sbTopSpace">
                    <DataTable
                      headers={[
                        { key: "team", label: "Team" },
                        { key: "score", label: "Score", numeric: true },
                        { key: "4s", label: "4S", numeric: true },
                        { key: "-4s", label: "-4S", numeric: true },
                        { key: "bh", label: "BH", numeric: true },
                        { key: "bpts", label: "BPTS", numeric: true },
                        { key: "ppb", label: "PPB", numeric: true },
                      ]}
                      rows={teamSummaryRows}
                    />
                  </div>
                </div>

                {playerTables.map((pt) => (
                  <div key={`${g.game_id}-${pt.teamName}`}>
                    <h4 className="m-0 text-xs font-semibold">{pt.teamName}</h4>
                    <div className="sbTopSpace">
                      <DataTable
                        headers={[
                          { key: "player", label: "Player" },
                          { key: "tuh", label: "TUH", numeric: true },
                          { key: "4s", label: "4s", numeric: true },
                          { key: "-4s", label: "-4s", numeric: true },
                          { key: "tu_pts", label: "TU Pts", numeric: true },
                        ]}
                        rows={pt.rows}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
