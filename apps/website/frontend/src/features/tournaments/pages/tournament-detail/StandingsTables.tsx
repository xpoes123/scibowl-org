import type { ReactNode } from "react";
import type { IndividualStandingsRow, TeamStandingsRow } from "../../types";
import { comparePointsPerTuh, formatPointsPerTuh, pointsPerTuh, pointsPerTuhLabel } from "./statsRates";

function formatFixedNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return (0).toFixed(digits);
  return value.toFixed(digits);
}

function DataTable({ headers, rows }: { headers: Array<{ key: string; label: string; numeric?: boolean }>; rows: Array<Record<string, ReactNode>> }) {
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

export function TeamStandingsTable({
  rows,
  tuhScale,
  showWinsLosses = true,
  onTeamSelect,
}: {
  rows: TeamStandingsRow[];
  tuhScale: number;
  showWinsLosses?: boolean;
  onTeamSelect?: (teamId: number) => void;
}) {
  const headers = [
    { key: "rank", label: "Rank", numeric: true },
    { key: "name", label: "Team" },
    ...(showWinsLosses
      ? [{ key: "wins", label: "W", numeric: true }, { key: "losses", label: "L", numeric: true }]
      : [{ key: "gp", label: "GP", numeric: true }]),
    { key: "pptuh", label: pointsPerTuhLabel(tuhScale), numeric: true },
    { key: "4s", label: "4s", numeric: true },
    { key: "-4s", label: "-4s", numeric: true },
    { key: "tuh", label: "TUH", numeric: true },
    { key: "bh", label: "BH", numeric: true },
    { key: "bp", label: "BPTs", numeric: true },
    { key: "ppb", label: "PPB", numeric: true },
  ];

  // Overall standings keep the file's order and ranks, which may be set by hand (e.g. tiebreaks).
  // Category standings have no such ordering, so rank them by points per tossup heard.
  const orderedRows = showWinsLosses
    ? rows
    : [...rows].sort((a, b) => {
        const byRate = comparePointsPerTuh(pointsPerTuh(a.points, a.tossups_heard, 1), pointsPerTuh(b.points, b.tossups_heard, 1));
        if (byRate !== 0) return byRate;
        if (b.points !== a.points) return b.points - a.points;
        return a.name.localeCompare(b.name);
      });

  const tableRows = orderedRows.map((r, idx) => ({
    rank: showWinsLosses ? r.rank : idx + 1,
    name: onTeamSelect ? (
      <button
        type="button"
        className="sbInlineLink"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        onClick={() => onTeamSelect(r.team_id)}
      >
        {r.name}
      </button>
    ) : (
      r.name
    ),
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    gp: r.games_played ?? 0,
    pptuh: formatPointsPerTuh(pointsPerTuh(r.points, r.tossups_heard, tuhScale)),
    "4s": r["4s"],
    "-4s": r["-4s"],
    tuh: r.tossups_heard,
    bh: r.bonuses_heard,
    bp: r.bonus_points,
    ppb: formatFixedNumber(r.points_per_bonus, 2),
  }));

  return <DataTable headers={headers} rows={tableRows} />;
}

export function IndividualStandingsTable({
  rows,
  tuhScale,
  onPlayerSelect,
}: {
  rows: IndividualStandingsRow[];
  tuhScale: number;
  onPlayerSelect?: (playerId: number) => void;
}) {
  const headers = [
    { key: "rank", label: "Rank", numeric: true },
    { key: "name", label: "Player" },
    { key: "team", label: "Team" },
    { key: "gp", label: "GP", numeric: true },
    { key: "4s", label: "4s", numeric: true },
    { key: "-4s", label: "-4s", numeric: true },
    { key: "tuh", label: "TUH", numeric: true },
    { key: "tp", label: "TU Pts", numeric: true },
    { key: "pptuh", label: pointsPerTuhLabel(tuhScale), numeric: true },
  ];

  // Ranked by points per tossup heard, with no minimum; no tossups heard sorts last.
  const sortedRows = [...rows].sort((a, b) => {
    const byRate = comparePointsPerTuh(pointsPerTuh(a.tossup_points, a.tossups_heard, 1), pointsPerTuh(b.tossup_points, b.tossups_heard, 1));
    if (byRate !== 0) return byRate;

    const aTp = Number.isFinite(a.tossup_points) ? a.tossup_points : -Infinity;
    const bTp = Number.isFinite(b.tossup_points) ? b.tossup_points : -Infinity;
    if (bTp !== aTp) return bTp - aTp;

    return a.name.localeCompare(b.name);
  });

  const tableRows = sortedRows.map((r, idx) => ({
    rank: idx + 1,
    name: onPlayerSelect ? (
      <button
        type="button"
        className="sbInlineLink"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        onClick={() => onPlayerSelect(r.player_id)}
      >
        {r.name}
      </button>
    ) : (
      r.name
    ),
    team: r.team,
    gp: r.games_played,
    "4s": r["4s"],
    "-4s": r["-4s"],
    tuh: r.tossups_heard,
    tp: r.tossup_points,
    pptuh: formatPointsPerTuh(pointsPerTuh(r.tossup_points, r.tossups_heard, tuhScale)),
  }));

  return <DataTable headers={headers} rows={tableRows} />;
}
