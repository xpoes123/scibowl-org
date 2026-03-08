import { useMemo, type ReactNode } from "react";

type TeamDetailViewProps = {
  games: Array<Record<string, string>> | null;
  gameTeams: Array<Record<string, string>> | null;
  gamePlayers: Array<Record<string, string>> | null;
  rounds: Array<Record<string, string>> | null;
  teamValue: string;
  onTeamChange: (value: string) => void;
  onPlayerSelect?: (playerId: number) => void;
  categoryKey: string | null;
  categoryLabel: string | null;
  gameTeamsByCategory: Array<Record<string, string>> | null;
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
  const name = (roundName || "").trim();
  const packet = (packetName || "").trim();
  const suffix = name || packet ? `: ${name || packet}` : "";
  return `Round ${roundNumber}${suffix}`;
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

export function TeamDetailView({
  games,
  gameTeams,
  gamePlayers,
  rounds,
  teamValue,
  onTeamChange,
  onPlayerSelect,
  categoryKey,
  categoryLabel,
  gameTeamsByCategory,
  gamePlayersByCategory,
}: TeamDetailViewProps) {
  const teamOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of gameTeams ?? []) {
      const teamId = toIntOrNull(row.team_id);
      if (teamId === null) continue;
      map.set(teamId, row.team_name ?? `Team ${teamId}`);
    }
    const out = Array.from(map.entries()).map(([teamId, teamName]) => ({
      value: String(teamId),
      label: teamName,
    }));
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [gameTeams]);

  const selectedTeamId = useMemo(() => {
    const parsed = Number.parseInt(teamValue, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }, [teamValue]);

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

  const isCategoryMode = categoryKey !== null;

  const categoryTeamRows = useMemo(() => {
    if (!isCategoryMode || selectedTeamId === null) return [];
    const cat = categoryKey ?? "";
    return (gameTeamsByCategory ?? []).filter((r) => toIntOrNull(r.team_id) === selectedTeamId && (r.category ?? "") === cat);
  }, [categoryKey, gameTeamsByCategory, isCategoryMode, selectedTeamId]);

  const gamesTableRows = useMemo(() => {
    if (selectedTeamId === null) return [];

    if (isCategoryMode) {
      const categoryAggByGameId = new Map<number, { tu_pts: number; b_pts: number; c: number; i: number; n: number; bc: number; bi: number; bu: number }>();
      for (const row of categoryTeamRows) {
        const gameId = toIntOrNull(row.game_id);
        if (gameId === null) continue;
        const existing = categoryAggByGameId.get(gameId) ?? { tu_pts: 0, b_pts: 0, c: 0, i: 0, n: 0, bc: 0, bi: 0, bu: 0 };
        existing.tu_pts += toInt(row.tossup_points);
        existing.b_pts += toInt(row.bonus_points);
        existing.c += toInt(row.tossups_correct);
        existing.i += toInt(row.tossups_incorrect);
        existing.n += toInt(row.tossups_no_penalty);
        existing.bc += toInt(row.bonuses_correct);
        existing.bi += toInt(row.bonuses_incorrect);
        existing.bu += toInt(row.bonuses_unheard);
        categoryAggByGameId.set(gameId, existing);
      }

      const playedGameIds = new Set<number>();
      for (const row of gameTeams ?? []) {
        const teamId = toIntOrNull(row.team_id);
        const gameId = toIntOrNull(row.game_id);
        if (teamId === null || gameId === null) continue;
        if (teamId !== selectedTeamId) continue;
        playedGameIds.add(gameId);
      }

      const out = Array.from(playedGameIds.values()).map((gameId) => {
        const oppRows = gameTeamsByGameId.get(gameId) ?? [];
        const opp = oppRows.find((r) => toIntOrNull(r.team_id) !== selectedTeamId) ?? null;

        const g = gamesById.get(gameId) ?? null;
        const sortRound = g?.round_number ?? 999999;
        const roundInfo = g?.round_number !== null && g?.round_number !== undefined ? roundsByNumber.get(g.round_number) : null;
        const roundLabel = formatRoundLabel(g?.round_number ?? null, (roundInfo?.round_name ?? g?.round_name) || "", (roundInfo?.packet_name ?? g?.packet_name) || "");

        const agg = categoryAggByGameId.get(gameId) ?? { tu_pts: 0, b_pts: 0, c: 0, i: 0, n: 0, bc: 0, bi: 0, bu: 0 };
        const tuh = agg.c + agg.i + agg.n;
        const bh = agg.bc + agg.bi + agg.bu;
        const ppb = bh > 0 ? agg.b_pts / bh : 0;

        return {
          __key: String(gameId),
          __sortRound: sortRound,
          __sortGame: gameId,
          round: roundLabel,
          opponent: opp?.team_name ?? "",
          tu_pts: agg.tu_pts,
          b_pts: agg.b_pts,
          tuh,
          bh,
          ppb: formatNumber(ppb, 2),
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
        if (aG !== bG) return aG - bG;
        return String(a.opponent).localeCompare(String(b.opponent));
      });
      return out;
    }

    const myRows = (gameTeams ?? []).filter((r) => toIntOrNull(r.team_id) === selectedTeamId);
    const out = myRows.map((t) => {
      const gameId = toIntOrNull(t.game_id) ?? 0;
      const oppRows = gameTeamsByGameId.get(gameId) ?? [];
      const opp = oppRows.find((r) => toIntOrNull(r.team_id) !== selectedTeamId) ?? null;

      const myScore = toInt(t.score);
      const oppScore = toInt(opp?.score);
      const result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T";

      const g = gamesById.get(gameId) ?? null;
      const sortRound = g?.round_number ?? 999999;
      const roundInfo = g?.round_number !== null && g?.round_number !== undefined ? roundsByNumber.get(g.round_number) : null;
      const roundLabel = formatRoundLabel(g?.round_number ?? null, (roundInfo?.round_name ?? g?.round_name) || "", (roundInfo?.packet_name ?? g?.packet_name) || "");

      const tuh = toInt(t.tossups_correct) + toInt(t.tossups_incorrect) + toInt(t.tossups_no_penalty);
      const bh = toInt(t.bonuses_correct) + toInt(t.bonuses_incorrect) + toInt(t.bonuses_unheard);
      const ppb = bh > 0 ? toInt(t.bonus_points) / bh : 0;

      return {
        __key: String(gameId),
        __sortRound: sortRound,
        __sortGame: gameId,
        round: roundLabel,
        opponent: opp?.team_name ?? "",
        result,
        score: myScore,
        opp: oppScore,
        tu_pts: toInt(t.tossup_points),
        b_pts: toInt(t.bonus_points),
        tuh,
        bh,
        ppb: formatNumber(ppb, 2),
        "4s": toInt(t.tossups_correct),
        "-4s": toInt(t.tossups_incorrect),
        "0s": toInt(t.tossups_no_penalty),
      };
    });

    out.sort((a, b) => {
      const aR = Number(a.__sortRound) || 0;
      const bR = Number(b.__sortRound) || 0;
      if (aR !== bR) return aR - bR;
      const aG = Number(a.__sortGame) || 0;
      const bG = Number(b.__sortGame) || 0;
      if (aG !== bG) return aG - bG;
      return String(a.opponent).localeCompare(String(b.opponent));
    });
    return out;
  }, [categoryTeamRows, gameTeams, gameTeamsByGameId, gamesById, isCategoryMode, roundsByNumber, selectedTeamId]);

  const playerRows = useMemo(() => {
    if (selectedTeamId === null) return [];

    if (isCategoryMode) {
      const cat = categoryKey ?? "";
      type PlayerMeta = { player_id: number; player_name: string; gameIds: Set<number> };
      const playedByPlayer = new Map<number, PlayerMeta>();
      for (const row of (gamePlayers ?? []).filter((r) => toIntOrNull(r.team_id) === selectedTeamId)) {
        const playerId = toIntOrNull(row.player_id);
        if (playerId === null) continue;
        const gameId = toIntOrNull(row.game_id);
        const existing = playedByPlayer.get(playerId) ?? { player_id: playerId, player_name: row.player_name ?? "", gameIds: new Set<number>() };
        if (gameId !== null) existing.gameIds.add(gameId);
        playedByPlayer.set(playerId, existing);
      }

      const categoryByPlayer = new Map<number, { tu_pts: number; c: number; i: number; n: number }>();
      for (const row of (gamePlayersByCategory ?? []).filter(
        (r) => toIntOrNull(r.team_id) === selectedTeamId && (r.category ?? "") === cat,
      )) {
        const playerId = toIntOrNull(row.player_id);
        if (playerId === null) continue;
        const existing = categoryByPlayer.get(playerId) ?? { tu_pts: 0, c: 0, i: 0, n: 0 };
        existing.tu_pts += toInt(row.tossup_points);
        existing.c += toInt(row.tossups_correct);
        existing.i += toInt(row.tossups_incorrect);
        existing.n += toInt(row.tossups_no_penalty);
        categoryByPlayer.set(playerId, existing);
      }

      const out = Array.from(playedByPlayer.values()).map((p) => {
        const gp = p.gameIds.size;
        const agg = categoryByPlayer.get(p.player_id) ?? { tu_pts: 0, c: 0, i: 0, n: 0 };
        const ans = agg.c + agg.i + agg.n;
        const ppg = gp > 0 ? agg.tu_pts / gp : 0;
        return {
          __key: String(p.player_id),
          player: onPlayerSelect ? (
            <button
              type="button"
              className="sbInlineLink"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              onClick={() => onPlayerSelect(p.player_id)}
            >
              {p.player_name}
            </button>
          ) : (
            p.player_name
          ),
          gp,
          ans,
          tu_pts: agg.tu_pts,
          ppg: formatNumber(ppg, 2),
          "4s": agg.c,
          "-4s": agg.i,
          "0s": agg.n,
        };
      });

      out.sort((a, b) => {
        const aPts = Number(a.tu_pts) || 0;
        const bPts = Number(b.tu_pts) || 0;
        if (bPts !== aPts) return bPts - aPts;
        return String(a.player).localeCompare(String(b.player));
      });

      return out;
    }

    type Agg = { player_id: number; player_name: string; tu_pts: number; tuh: number; c: number; i: number; n: number; gameIds: Set<number> };
    const byPlayer = new Map<number, Agg>();

    for (const row of (gamePlayers ?? []).filter((r) => toIntOrNull(r.team_id) === selectedTeamId)) {
      const playerId = toIntOrNull(row.player_id);
      if (playerId === null) continue;
      const gameId = toIntOrNull(row.game_id);

      const existing =
        byPlayer.get(playerId) ??
        ({
          player_id: playerId,
          player_name: row.player_name ?? "",
          tu_pts: 0,
          tuh: 0,
          c: 0,
          i: 0,
          n: 0,
          gameIds: new Set<number>(),
        } satisfies Agg);

      if (gameId !== null) existing.gameIds.add(gameId);
      existing.tuh += toInt(row.pairs_heard);
      existing.tu_pts += toInt(row.tossup_points);
      existing.c += toInt(row.tossups_correct);
      existing.i += toInt(row.tossups_incorrect);
      existing.n += toInt(row.tossups_no_penalty);
      byPlayer.set(playerId, existing);
    }

    const out = Array.from(byPlayer.values()).map((p) => {
      const gp = p.gameIds.size;
      const ppg = gp > 0 ? p.tu_pts / gp : 0;
      return {
        __key: String(p.player_id),
        player: onPlayerSelect ? (
          <button
            type="button"
            className="sbInlineLink"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            onClick={() => onPlayerSelect(p.player_id)}
          >
            {p.player_name}
          </button>
        ) : (
          p.player_name
        ),
        gp,
        tuh: p.tuh,
        tu_pts: p.tu_pts,
        ppg: formatNumber(ppg, 2),
        "4s": p.c,
        "-4s": p.i,
        "0s": p.n,
      };
    });

    out.sort((a, b) => {
      const aPts = Number(a.tu_pts) || 0;
      const bPts = Number(b.tu_pts) || 0;
      if (bPts !== aPts) return bPts - aPts;
      return String(a.player).localeCompare(String(b.player));
    });

    return out;
  }, [categoryKey, gamePlayers, gamePlayersByCategory, isCategoryMode, onPlayerSelect, selectedTeamId]);

  return (
    <div className="sbTabStack">
      <div className="sbListingControls">
        <div className="sbField" style={{ flex: "0 1 340px", minWidth: "240px" }}>
          <select
            id="team-detail-team"
            aria-label="Team"
            className="sbSelect"
            value={teamValue}
            onChange={(e) => onTeamChange(e.target.value)}
          >
            {teamOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h3 className="m-0 text-sm font-semibold">{isCategoryMode ? `Games (${categoryLabel ?? categoryKey})` : "Games"}</h3>
        <div className="sbTopSpace">
          <DataTable
            headers={
              isCategoryMode
                ? [
                    { key: "round", label: "Round" },
                    { key: "opponent", label: "Opponent" },
                    { key: "tu_pts", label: "TU Pts", numeric: true },
                    { key: "b_pts", label: "B Pts", numeric: true },
                    { key: "tuh", label: "TUH", numeric: true },
                    { key: "bh", label: "BH", numeric: true },
                    { key: "ppb", label: "PPB", numeric: true },
                    { key: "4s", label: "4s", numeric: true },
                    { key: "-4s", label: "-4s", numeric: true },
                    { key: "0s", label: "0s", numeric: true },
                  ]
                : [
                    { key: "round", label: "Round" },
                    { key: "opponent", label: "Opponent" },
                    { key: "result", label: "R" },
                    { key: "score", label: "Pts", numeric: true },
                    { key: "opp", label: "Opp", numeric: true },
                    { key: "tu_pts", label: "TU Pts", numeric: true },
                    { key: "b_pts", label: "B Pts", numeric: true },
                    { key: "tuh", label: "TUH", numeric: true },
                    { key: "bh", label: "BH", numeric: true },
                    { key: "ppb", label: "PPB", numeric: true },
                    { key: "4s", label: "4s", numeric: true },
                    { key: "-4s", label: "-4s", numeric: true },
                    { key: "0s", label: "0s", numeric: true },
                  ]
            }
            rows={gamesTableRows}
          />
        </div>
      </div>

      <div>
        <h3 className="m-0 text-sm font-semibold">
          {isCategoryMode ? `Player Statistics (${categoryLabel ?? categoryKey})` : "Player Statistics"}
        </h3>
        <div className="sbTopSpace">
          <DataTable
            headers={
              isCategoryMode
                ? [
                    { key: "player", label: "Player" },
                    { key: "gp", label: "GP", numeric: true },
                    { key: "ans", label: "Ans", numeric: true },
                    { key: "tu_pts", label: "TU Pts", numeric: true },
                    { key: "ppg", label: "PPG", numeric: true },
                    { key: "4s", label: "4s", numeric: true },
                    { key: "-4s", label: "-4s", numeric: true },
                    { key: "0s", label: "0s", numeric: true },
                  ]
                : [
                    { key: "player", label: "Player" },
                    { key: "gp", label: "GP", numeric: true },
                    { key: "tuh", label: "TUH", numeric: true },
                    { key: "tu_pts", label: "TU Pts", numeric: true },
                    { key: "ppg", label: "PPG", numeric: true },
                    { key: "4s", label: "4s", numeric: true },
                    { key: "-4s", label: "-4s", numeric: true },
                    { key: "0s", label: "0s", numeric: true },
                  ]
            }
            rows={playerRows}
          />
        </div>
      </div>
    </div>
  );
}
