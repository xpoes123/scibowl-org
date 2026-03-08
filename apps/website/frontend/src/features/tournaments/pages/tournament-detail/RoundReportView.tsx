import { useEffect, useMemo } from "react";
import { formatPacketOrRoundLabel } from "./statsText";

type RoundReportViewProps = {
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

function formatFixedNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return (0).toFixed(digits);
  return value.toFixed(digits);
}

function DataTable({
  headers,
  rows,
}: {
  headers: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, string | number> & { __key?: string }>;
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

export function RoundReportView({ games, gameTeams, gamePlayers, rounds, roundValue, onRoundChange }: RoundReportViewProps) {
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
    }));
  }, [games]);

  const hasUnassigned = useMemo(() => parsedGames.some((g) => g.round_number === null), [parsedGames]);

  const gameCounts = useMemo(() => {
    const byRound = new Map<number, number>();
    let unassigned = 0;
    for (const g of parsedGames) {
      if (g.round_number === null) {
        unassigned += 1;
        continue;
      }
      byRound.set(g.round_number, (byRound.get(g.round_number) ?? 0) + 1);
    }
    return { total: parsedGames.length, byRound, unassigned };
  }, [parsedGames]);

  const roundSelectOptions = useMemo(() => {
    const gameWord = (n: number) => (n === 1 ? "game" : "games");
    const opts: Array<{ value: string; label: string }> = [];
    for (const r of parsedRounds) {
      if (r.round_number === null) continue;
      const count = gameCounts.byRound.get(r.round_number) ?? 0;
      if (count === 0) continue;
      opts.push({
        value: String(r.round_number),
        label: `${formatPacketOrRoundLabel(r.round_number, r.round_name, r.packet_name)} (${count} ${gameWord(count)})`,
      });
    }
    if (hasUnassigned) opts.push({ value: "_unassigned", label: `Unassigned (${gameCounts.unassigned} ${gameWord(gameCounts.unassigned)})` });
    return opts;
  }, [gameCounts, hasUnassigned, parsedRounds]);

  useEffect(() => {
    if (roundSelectOptions.length === 0) return;
    const available = new Set(roundSelectOptions.map((o) => o.value));
    if (available.has(roundValue)) return;
    onRoundChange(roundSelectOptions[0].value);
  }, [onRoundChange, roundSelectOptions, roundValue]);

  const effectiveRoundValue = useMemo(() => {
    if (roundSelectOptions.length === 0) return roundValue;
    const available = new Set(roundSelectOptions.map((o) => o.value));
    if (available.has(roundValue)) return roundValue;
    return roundSelectOptions[0].value;
  }, [roundSelectOptions, roundValue]);

  const selectedGameIds = useMemo(() => {
    if (effectiveRoundValue === "_unassigned") return new Set(parsedGames.filter((g) => g.round_number === null).map((g) => g.game_id));

    const selected = Number.parseInt(effectiveRoundValue, 10);
    if (!Number.isFinite(selected)) return new Set(parsedGames.map((g) => g.game_id));
    return new Set(parsedGames.filter((g) => g.round_number === selected).map((g) => g.game_id));
  }, [effectiveRoundValue, parsedGames]);

  const showGp = false;

  const teamRows = useMemo(() => {
    type TeamAgg = {
      team_id: number;
      team_name: string;
      games_played: number;
      score: number;
      tossup_points: number;
      bonus_points: number;
      tossups_correct: number;
      tossups_incorrect: number;
      tossups_no_penalty: number;
      bonuses_correct: number;
      bonuses_incorrect: number;
      bonuses_unheard: number;
    };

    const byTeam = new Map<number, TeamAgg>();

    for (const row of gameTeams ?? []) {
      const gameId = toIntOrNull(row.game_id);
      const teamId = toIntOrNull(row.team_id);
      if (gameId === null || teamId === null) continue;
      if (!selectedGameIds.has(gameId)) continue;

      const existing = byTeam.get(teamId) ?? {
        team_id: teamId,
        team_name: row.team_name ?? "",
        games_played: 0,
        score: 0,
        tossup_points: 0,
        bonus_points: 0,
        tossups_correct: 0,
        tossups_incorrect: 0,
        tossups_no_penalty: 0,
        bonuses_correct: 0,
        bonuses_incorrect: 0,
        bonuses_unheard: 0,
      };

      existing.games_played += 1;
      existing.score += toInt(row.score);
      existing.tossup_points += toInt(row.tossup_points);
      existing.bonus_points += toInt(row.bonus_points);
      existing.tossups_correct += toInt(row.tossups_correct);
      existing.tossups_incorrect += toInt(row.tossups_incorrect);
      existing.tossups_no_penalty += toInt(row.tossups_no_penalty);
      existing.bonuses_correct += toInt(row.bonuses_correct);
      existing.bonuses_incorrect += toInt(row.bonuses_incorrect);
      existing.bonuses_unheard += toInt(row.bonuses_unheard);

      byTeam.set(teamId, existing);
    }

    const out = Array.from(byTeam.values()).map((t) => {
      const tuh = t.tossups_correct + t.tossups_incorrect + t.tossups_no_penalty;
      const bh = t.bonuses_correct + t.bonuses_incorrect;
      const ppb = bh > 0 ? t.bonus_points / bh : 0;
      const ppg = t.games_played > 0 ? t.score / t.games_played : 0;

      return {
        __key: String(t.team_id),
        team: t.team_name,
        gp: t.games_played,
        score: t.score,
        ppg: formatFixedNumber(ppg, 2),
        tuh,
        bh,
        bpts: t.bonus_points,
        ppb: formatFixedNumber(ppb, 2),
        "4s": t.tossups_correct,
        "-4s": t.tossups_incorrect,
      };
    });

    out.sort((a, b) => {
      const aPpg = Number.parseFloat(String(a.ppg)) || 0;
      const bPpg = Number.parseFloat(String(b.ppg)) || 0;
      if (bPpg !== aPpg) return bPpg - aPpg;
      if (b.score !== a.score) return b.score - a.score;
      return String(a.team).localeCompare(String(b.team));
    });

    return out;
  }, [gameTeams, selectedGameIds]);

  const playerRows = useMemo(() => {
    type PlayerAgg = {
      player_id: number;
      player_name: string;
      team_name: string;
      games_played: number;
      tossup_points: number;
      pairs_heard: number;
      tossups_correct: number;
      tossups_incorrect: number;
      tossups_no_penalty: number;
    };

    const byPlayer = new Map<number, PlayerAgg>();

    for (const row of gamePlayers ?? []) {
      const gameId = toIntOrNull(row.game_id);
      const playerId = toIntOrNull(row.player_id);
      if (gameId === null || playerId === null) continue;
      if (!selectedGameIds.has(gameId)) continue;

      const existing = byPlayer.get(playerId) ?? {
        player_id: playerId,
        player_name: row.player_name ?? "",
        team_name: row.team_name ?? "",
        games_played: 0,
        tossup_points: 0,
        pairs_heard: 0,
        tossups_correct: 0,
        tossups_incorrect: 0,
        tossups_no_penalty: 0,
      };

      existing.games_played += 1;
      existing.tossup_points += toInt(row.tossup_points);
      existing.pairs_heard += toInt(row.pairs_heard);
      existing.tossups_correct += toInt(row.tossups_correct);
      existing.tossups_incorrect += toInt(row.tossups_incorrect);
      existing.tossups_no_penalty += toInt(row.tossups_no_penalty);

      byPlayer.set(playerId, existing);
    }

    const out = Array.from(byPlayer.values()).map((p) => {
      const ppg = p.games_played > 0 ? p.tossup_points / p.games_played : 0;
      return {
        __key: String(p.player_id),
        player: p.player_name,
        team: p.team_name,
        gp: p.games_played,
        tuh: p.pairs_heard,
        tu_pts: p.tossup_points,
        ppg: formatFixedNumber(ppg, 2),
        "4s": p.tossups_correct,
        "-4s": p.tossups_incorrect,
      };
    });

    out.sort((a, b) => {
      const aPpg = Number.parseFloat(String(a.ppg)) || 0;
      const bPpg = Number.parseFloat(String(b.ppg)) || 0;
      if (bPpg !== aPpg) return bPpg - aPpg;
      if (b.tu_pts !== a.tu_pts) return Number(b.tu_pts) - Number(a.tu_pts);
      return String(a.player).localeCompare(String(b.player));
    });

    return out;
  }, [gamePlayers, selectedGameIds]);

  return (
    <div className="sbTabStack">
      <div className="sbListingControls">
        <div className="sbField" style={{ flex: "0 1 340px", minWidth: "240px" }}>
          <select
            id="round-report-round"
            aria-label="Round"
            className="sbSelect"
            value={effectiveRoundValue}
            onChange={(e) => onRoundChange(e.target.value)}
            disabled={roundSelectOptions.length === 0}
          >
            {roundSelectOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <h3 className="m-0 text-sm font-semibold">Team Statistics</h3>
        <div className="sbTopSpace">
          <DataTable
            headers={[
              { key: "team", label: "Team" },
              ...(showGp ? [{ key: "gp", label: "GP", numeric: true }] : []),
              { key: "ppg", label: "PPG", numeric: true },
              { key: "4s", label: "4s", numeric: true },
              { key: "-4s", label: "-4s", numeric: true },
              { key: "tuh", label: "TUH", numeric: true },
              { key: "bh", label: "BH", numeric: true },
              { key: "bpts", label: "BPTS", numeric: true },
              { key: "ppb", label: "PPB", numeric: true },
            ]}
            rows={teamRows}
          />
        </div>
      </div>

      <div>
        <h3 className="m-0 text-sm font-semibold">Individual Statistics</h3>
        <div className="sbTopSpace">
          <DataTable
            headers={[
              { key: "player", label: "Player" },
              { key: "team", label: "Team" },
              ...(showGp ? [{ key: "gp", label: "GP", numeric: true }] : []),
              { key: "ppg", label: "PPG", numeric: true },
              { key: "4s", label: "4s", numeric: true },
              { key: "-4s", label: "-4s", numeric: true },
              { key: "tuh", label: "TUH", numeric: true },
              { key: "tu_pts", label: "TU Pts", numeric: true },
            ]}
            rows={playerRows}
          />
        </div>
      </div>
    </div>
  );
}
