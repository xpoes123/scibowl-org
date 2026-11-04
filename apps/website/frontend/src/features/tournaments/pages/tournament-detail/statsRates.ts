import type { TournamentStatsManifest } from "../../types";

// Points per N tossups heard (P/NTUH). N comes from the stats manifest (see stats/README.md) and
// only affects display; the CSVs store raw points and tossups heard.
export const DEFAULT_TUH_SCALE = 20;

export function tuhScaleFromManifest(manifest: TournamentStatsManifest | null | undefined): number {
  const scale = manifest?.stats_options?.tuh_scale;
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_TUH_SCALE;
}

export function pointsPerTuhLabel(tuhScale: number): string {
  return `P/${tuhScale}TUH`;
}

// null when no tossups were heard, so there is nothing to divide by.
export function pointsPerTuh(points: number, tossupsHeard: number, tuhScale: number): number | null {
  if (!Number.isFinite(points) || !Number.isFinite(tossupsHeard) || tossupsHeard <= 0) return null;
  return (points * tuhScale) / tossupsHeard;
}

export function formatPointsPerTuh(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

// Highest first; no tossups heard sorts last.
export function comparePointsPerTuh(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}
