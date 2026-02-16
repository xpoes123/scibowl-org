import type { ReactNode } from "react";
import type { IndividualStandingsRow, TeamStandingsRow } from "../../types";

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
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

export function TeamStandingsTable({ rows }: { rows: TeamStandingsRow[] }) {
  const headers = [
    { key: "rank", label: "Rank", numeric: true },
    { key: "name", label: "Team" },
    { key: "wins", label: "W", numeric: true },
    { key: "losses", label: "L", numeric: true },
    { key: "ppg", label: "PPG", numeric: true },
    { key: "4s", label: "4s", numeric: true },
    { key: "-4s", label: "-4s", numeric: true },
    { key: "0s", label: "0s", numeric: true },
    { key: "tuh", label: "TUH", numeric: true },
    { key: "bh", label: "BH", numeric: true },
    { key: "bp", label: "Bonus Pts", numeric: true },
    { key: "ppb", label: "PPB", numeric: true },
  ];

  const tableRows = rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    wins: r.wins,
    losses: r.losses,
    ppg: formatNumber(r.points_per_game),
    "4s": r["4s"],
    "-4s": r["-4s"],
    "0s": r["0s"],
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
    { key: "0s", label: "0s", numeric: true },
    { key: "tuh", label: "TUH", numeric: true },
    { key: "tp", label: "TU Pts", numeric: true },
    { key: "ppg", label: "Pts/G", numeric: true },
  ];

  const tableRows = rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    team: r.team,
    gp: r.games_played,
    "4s": r["4s"],
    "-4s": r["-4s"],
    "0s": r["0s"],
    tuh: r.tossups_heard,
    tp: r.tossup_points,
    ppg: formatNumber(r.points_per_game),
  }));

  return <DataTable headers={headers} rows={tableRows} />;
}
