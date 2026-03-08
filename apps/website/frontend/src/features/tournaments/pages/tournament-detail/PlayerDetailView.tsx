import { useMemo, type ReactNode } from "react";
import { formatPacketOrRoundLabel } from "./statsText";

type PlayerDetailViewProps = {
  games: Array<Record<string, string>> | null;
  gameTeams: Array<Record<string, string>> | null;
  gamePlayers: Array<Record<string, string>> | null;
  rounds: Array<Record<string, string>> | null;
  playerValue: string;
  onPlayerChange: (value: string) => void;
  onTeamSelect?: (teamId: number) => void;
  categoryKey: string | null;
  categoryLabel: string | null;
  gamePlayersByCategory: Array<Record<string, string>> | null;
};

function toIntOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function toInt(raw: string | undefined): number {
  return toIntOrNull(raw) ?? 0;
}

function formatRoundLabel(roundNumber: number | null, roundName: string, packetName: string): string {
  if (roundNumber === null) return "Unassigned";
  return formatPacketOrRoundLabel(roundNumber, roundName, packetName);
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
  rows: Array<Record<string, ReactNode> & { __key?: string }>;
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
            <tr key={row.__key ?? idx}>
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

export function PlayerDetailView({
  games,
  gameTeams,
  gamePlayers,
  rounds,
  playerValue,
  onPlayerChange,
  onTeamSelect,
  categoryKey,
  categoryLabel,
  gamePlayersByCategory,
}: PlayerDetailViewProps) {
  const playerOptions = useMemo(() => {
    type Entry = { player_id: number; player_name: string; team_name: string };
    const map = new Map<number, Entry>();

    for (const row of gamePlayers ?? []) {
      const playerId = toIntOrNull(row.player_id);
      if (playerId === null) continue;
      if (map.has(playerId)) continue;
      map.set(playerId, {
        player_id: playerId,
        player_name: row.player_name ?? `Player ${playerId}`,
        team_name: row.team_name ?? "",
      });
    }

    const out = Array.from(map.values()).map((p) => ({
      value: String(p.player_id),
      label: p.team_name ? `${p.player_name} (${p.team_name})` : p.player_name,
      player_name: p.player_name,
      team_name: p.team_name,
    }));

    out.sort((a, b) => {
      const name = a.player_name.localeCompare(b.player_name);
      if (name !== 0) return name;
      return a.team_name.localeCompare(b.team_name);
    });

    return out;
  }, [gamePlayers]);

  const selectedPlayerId = useMemo(() => {
    const parsed = Number.parseInt(playerValue, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }, [playerValue]);

  const isCategoryMode = categoryKey !== null;

  const roundsByNumber = useMemo(() => {
    const map = new Map<number, { round_name: string; packet_name: string }>();
    for (const row of rounds ?? []) {
      const roundNumber = toIntOrNull(row.round_number);
      if (roundNumber === null) continue;
      map.set(roundNumber, { round_name: row.round_name ?? "", packet_name: row.packet_name ?? "" });
    }
    return map;
  }, [rounds]);

  const gamesById = useMemo(() => {
    const map = new Map<number, { round_number: number | null; round_name: string; packet_name: string }>();
    for (const row of games ?? []) {
      const gameId = toIntOrNull(row.game_id);
      if (gameId === null) continue;
      const roundNumber = toIntOrNull(row.round_number);
      map.set(gameId, {
        round_number: roundNumber,
        round_name: row.round_name ?? "",
        packet_name: row.round_packet_name ?? row.packet_name ?? "",
      });
    }
    return map;
  }, [games]);

  const gameTeamsByGameId = useMemo(() => {
    const map = new Map<number, Array<Record<string, string>>>();
    for (const row of gameTeams ?? []) {
      const gameId = toIntOrNull(row.game_id);
      if (gameId === null) continue;
      const existing = map.get(gameId) ?? [];
      existing.push(row);
      map.set(gameId, existing);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => toInt(a.slot) - toInt(b.slot));
    }
    return map;
  }, [gameTeams]);

  const selectedPlayerRows = useMemo(() => {
    if (selectedPlayerId === null) return [];
    return (gamePlayers ?? []).filter((r) => toIntOrNull(r.player_id) === selectedPlayerId);
  }, [gamePlayers, selectedPlayerId]);

  const teamId = useMemo(() => {
    if (selectedPlayerRows.length === 0) return null;
    const parsed = toIntOrNull(selectedPlayerRows[0].team_id);
    return parsed;
  }, [selectedPlayerRows]);

  const teamName = useMemo(() => {
    if (selectedPlayerRows.length === 0) return "";
    return (selectedPlayerRows[0].team_name ?? "").trim();
  }, [selectedPlayerRows]);

  const gamesTableRows = useMemo(() => {
    if (selectedPlayerId === null) return [];

    if (isCategoryMode) {
      const cat = categoryKey ?? "";
      const relevant = (gamePlayersByCategory ?? []).filter(
        (r) => toIntOrNull(r.player_id) === selectedPlayerId && (r.category ?? "") === cat,
      );

      const byGameId = new Map<number, { c: number; i: number; n: number; tu_pts: number }>();
      for (const row of relevant) {
        const gameId = toIntOrNull(row.game_id);
        if (gameId === null) continue;
        const existing = byGameId.get(gameId) ?? { c: 0, i: 0, n: 0, tu_pts: 0 };
        existing.c += toInt(row.tossups_correct);
        existing.i += toInt(row.tossups_incorrect);
        existing.n += toInt(row.tossups_no_penalty);
        existing.tu_pts += toInt(row.tossup_points);
        byGameId.set(gameId, existing);
      }

      const playedGameIds = new Set<number>();
      for (const p of selectedPlayerRows) {
        const gameId = toIntOrNull(p.game_id);
        if (gameId === null) continue;
        playedGameIds.add(gameId);
      }

      const out = Array.from(playedGameIds.values()).map((gameId) => {
        const agg = byGameId.get(gameId) ?? { c: 0, i: 0, n: 0, tu_pts: 0 };
        const g = gamesById.get(gameId) ?? null;
        const sortRound = g?.round_number ?? 999999;
        const roundInfo = g?.round_number !== null && g?.round_number !== undefined ? roundsByNumber.get(g.round_number) : null;
        const roundLabel = formatRoundLabel(g?.round_number ?? null, (roundInfo?.round_name ?? g?.round_name) || "", (roundInfo?.packet_name ?? g?.packet_name) || "");

        const teams = gameTeamsByGameId.get(gameId) ?? [];
        const myTeamId = teamId;
        const opp = myTeamId !== null ? teams.find((r) => toIntOrNull(r.team_id) !== myTeamId) : null;

        const ans = agg.c + agg.i + agg.n;
        return {
          __key: String(gameId),
          __sortRound: sortRound,
          __sortGame: gameId,
          round: roundLabel,
          opponent: opp?.team_name ?? "",
          ans,
          tu_pts: agg.tu_pts,
          "4s": agg.c,
          "-4s": agg.i,
          "0s": agg.n,
        };
      });

      out.sort((a, b) => {
        const aR = Number(a.__sortRound) || 0;
        const bR = Number(b.__sortRound) || 0;
        if (aR !== bR) return aR - bR;
        const aG = Number(a.__sortGame) || 0;
        const bG = Number(b.__sortGame) || 0;
        return aG - bG;
      });

      return out;
    }

    const out = selectedPlayerRows.map((p) => {
      const gameId = toIntOrNull(p.game_id) ?? 0;
      const g = gamesById.get(gameId) ?? null;
      const sortRound = g?.round_number ?? 999999;
      const roundInfo = g?.round_number !== null && g?.round_number !== undefined ? roundsByNumber.get(g.round_number) : null;
      const roundLabel = formatRoundLabel(g?.round_number ?? null, (roundInfo?.round_name ?? g?.round_name) || "", (roundInfo?.packet_name ?? g?.packet_name) || "");

      const teams = gameTeamsByGameId.get(gameId) ?? [];
      const myTeamId = toIntOrNull(p.team_id);
      const opp = myTeamId !== null ? teams.find((r) => toIntOrNull(r.team_id) !== myTeamId) : null;

      return {
        __key: String(gameId),
        __sortRound: sortRound,
        __sortGame: gameId,
        round: roundLabel,
        opponent: opp?.team_name ?? "",
        tuh: toInt(p.pairs_heard),
        tu_pts: toInt(p.tossup_points),
        "4s": toInt(p.tossups_correct),
        "-4s": toInt(p.tossups_incorrect),
        "0s": toInt(p.tossups_no_penalty),
      };
    });

    out.sort((a, b) => {
      const aR = Number(a.__sortRound) || 0;
      const bR = Number(b.__sortRound) || 0;
      if (aR !== bR) return aR - bR;
      const aG = Number(a.__sortGame) || 0;
      const bG = Number(b.__sortGame) || 0;
      return aG - bG;
    });

    return out;
  }, [categoryKey, gamePlayersByCategory, gamesById, gameTeamsByGameId, isCategoryMode, roundsByNumber, selectedPlayerId, selectedPlayerRows, teamId]);

  const playerName = useMemo(() => {
    if (selectedPlayerRows.length === 0) return "";
    return (selectedPlayerRows[0].player_name ?? "").trim();
  }, [selectedPlayerRows]);

  return (
    <div className="sbTabStack">
      <div className="sbListingControls">
        <div className="sbField" style={{ flex: "0 1 340px", minWidth: "240px" }}>
          <select
            id="player-detail-player"
            aria-label="Player"
            className="sbSelect"
            value={playerValue}
            onChange={(e) => onPlayerChange(e.target.value)}
          >
            {playerOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      <div>
        <h3 className="m-0 text-sm font-semibold">
          {isCategoryMode ? `Games (${categoryLabel ?? categoryKey})` : "Games"}
          {playerName ? (
            <>
              {" — "}
              {playerName}
              {teamName ? (
                <>
                  {" ("}
                  {onTeamSelect && teamId !== null ? (
                    <button
                      type="button"
                      className="sbInlineLink"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                      onClick={() => onTeamSelect(teamId)}
                    >
                      {teamName}
                    </button>
                  ) : (
                    teamName
                  )}
                  {")"}
                </>
              ) : null}
            </>
          ) : null}
        </h3>
        <div className="sbTopSpace">
          <DataTable
            headers={
              isCategoryMode
                ? [
                    { key: "round", label: "Round" },
                    { key: "opponent", label: "Opponent" },
                    { key: "ans", label: "Ans", numeric: true },
                    { key: "tu_pts", label: "TU Pts", numeric: true },
                    { key: "4s", label: "4s", numeric: true },
                    { key: "-4s", label: "-4s", numeric: true },
                    { key: "0s", label: "0s", numeric: true },
                  ]
                : [
                    { key: "round", label: "Round" },
                    { key: "opponent", label: "Opponent" },
                    { key: "tuh", label: "TUH", numeric: true },
                    { key: "tu_pts", label: "TU Pts", numeric: true },
                    { key: "4s", label: "4s", numeric: true },
                    { key: "-4s", label: "-4s", numeric: true },
                    { key: "0s", label: "0s", numeric: true },
                  ]
            }
            rows={gamesTableRows}
          />
        </div>
      </div>
    </div>
  );
}
