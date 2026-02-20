import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sourceStatsDir = path.resolve(repoRoot, "stats");

const websiteRoot = path.resolve(repoRoot, "apps", "website", "frontend");
const mossRoot = path.resolve(repoRoot, "apps", "moss", "frontend");

const destStatsDirs = [
  path.resolve(websiteRoot, "public", "stats"),
  path.resolve(mossRoot, "public", "stats"),
];

const mossTournamentsOutPath = path.resolve(mossRoot, "src", "assets", "tournaments.json");
const tournamentsSourcePath = path.resolve(
  websiteRoot,
  "src",
  "features",
  "tournaments",
  "data",
  "tournaments.json"
);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(p, obj) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function generateRosterIndex() {
  if (!(await exists(sourceStatsDir))) {
    console.warn(`[sync-stats] No stats directory found at ${sourceStatsDir}; skipping roster index generation.`);
    return;
  }

  const entries = await readdir(sourceStatsDir, { withFileTypes: true });
  const slugs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    if (slug === "rosters") continue;
    const fieldPath = path.resolve(sourceStatsDir, slug, "field.json");
    if (await exists(fieldPath)) slugs.push(slug);
  }

  slugs.sort((a, b) => a.localeCompare(b));

  const indexPath = path.resolve(sourceStatsDir, "rosters", "index.json");
  await writeJson(indexPath, { format: "moss_roster_index", version: 1, slugs });
  console.log(`[sync-stats] Wrote ${path.relative(repoRoot, indexPath)} (${slugs.length} tournament(s))`);
}

async function syncStatsCopies() {
  if (!(await exists(sourceStatsDir))) {
    console.warn(`[sync-stats] No stats directory found at ${sourceStatsDir}; skipping stats sync.`);
    return;
  }

  for (const destDir of destStatsDirs) {
    await rm(destDir, { recursive: true, force: true });
    await cp(sourceStatsDir, destDir, { recursive: true });
    console.log(`[sync-stats] Synced ${path.relative(repoRoot, sourceStatsDir)} -> ${path.relative(repoRoot, destDir)}`);
  }
}

async function syncMossTournamentIndex() {
  if (!(await exists(tournamentsSourcePath))) {
    console.warn(`[sync-stats] Tournament source not found at ${tournamentsSourcePath}; skipping MoSS tournament index.`);
    return;
  }

  const raw = await readFile(tournamentsSourcePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`[sync-stats] Unexpected tournaments.json shape; expected an array.`);
  }

  const tournaments = parsed
    .filter((t) => t && typeof t === "object")
    .map((t) => ({
      slug: String(t.slug ?? ""),
      name: String(t.name ?? ""),
      timezone: String(t.timezone ?? "UTC"),
      dates: {
        start: String(t?.dates?.start ?? ""),
        end: String(t?.dates?.end ?? ""),
      },
      status: String(t.status ?? ""),
    }))
    .filter((t) => t.slug && t.name && t.dates.start && t.dates.end);

  await writeJson(mossTournamentsOutPath, { format: "moss_tournaments", version: 1, tournaments });
  console.log(`[sync-stats] Wrote ${path.relative(repoRoot, mossTournamentsOutPath)} (${tournaments.length} tournament(s))`);
}

export async function main() {
  await generateRosterIndex();
  await syncMossTournamentIndex();
  await syncStatsCopies();
}

await main();

