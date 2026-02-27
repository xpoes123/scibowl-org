import type { ReactNode } from "react";
import type { IndividualStandingsRow, TeamStandingsRow } from "../../types";

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits);
}

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

export function TeamStandingsTable({ rows, showWinsLosses = true }: { rows: TeamStandingsRow[]; showWinsLosses?: boolean }) {
  const headers = [
    { key: "rank", label: "Rank", numeric: true },
    { key: "name", label: "Team" },
    ...(showWinsLosses ? [{ key: "wins", label: "W", numeric: true }, { key: "losses", label: "L", numeric: true }] : []),
    { key: "ppg", label: "PPG", numeric: true },
    { key: "4s", label: "4s", numeric: true },
    { key: "-4s", label: "-4s", numeric: true },
    { key: "tuh", label: "TUH", numeric: true },
    { key: "bh", label: "BH", numeric: true },
    { key: "bp", label: "BPTs", numeric: true },
    { key: "ppb", label: "PPB", numeric: true },
  ];

  const tableRows = rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    ppg: formatFixedNumber(r.points_per_game, 2),
    "4s": r["4s"],
    "-4s": r["-4s"],
    tuh: r.tossups_heard,
    bh: r.bonuses_heard,
    bp: r.bonus_points,
    ppb: formatNumber(r.points_per_bonus),
  }));

  return <DataTable headers={headers} rows={tableRows} />;
}

export function IndividualStandingsTable({ rows }: { rows: IndividualStandingsRow[] }) {
  const headers = [
    { key: "rank", label: "Rank", numeric: true },
    { key: "name", label: "Player" },
    { key: "team", label: "Team" },
    { key: "gp", label: "GP", numeric: true },
    { key: "4s", label: "4s", numeric: true },
    { key: "-4s", label: "-4s", numeric: true },
    { key: "tuh", label: "TUH", numeric: true },
    { key: "tp", label: "TU Pts", numeric: true },
    { key: "ppg", label: "PPG", numeric: true },
  ];

  const sortedRows = [...rows].sort((a, b) => {
    const aPpg = Number.isFinite(a.points_per_game) ? a.points_per_game : -Infinity;
    const bPpg = Number.isFinite(b.points_per_game) ? b.points_per_game : -Infinity;
    if (bPpg !== aPpg) return bPpg - aPpg;

    const aTp = Number.isFinite(a.tossup_points) ? a.tossup_points : -Infinity;
    const bTp = Number.isFinite(b.tossup_points) ? b.tossup_points : -Infinity;
    if (bTp !== aTp) return bTp - aTp;

    return a.name.localeCompare(b.name);
  });

  const tableRows = sortedRows.map((r, idx) => ({
    rank: idx + 1,
    name: r.name,
    team: r.team,
    gp: r.games_played,
    "4s": r["4s"],
    "-4s": r["-4s"],
    tuh: r.tossups_heard,
    tp: r.tossup_points,
    ppg: formatFixedNumber(r.points_per_game, 2),
  }));

  return <DataTable headers={headers} rows={tableRows} />;
}
