import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mossRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(mossRoot, "..", "..", "..");

const sourceStatsDir = path.resolve(repoRoot, "stats");
const destStatsDir = path.resolve(mossRoot, "public", "stats");

const mossTournamentsOutPath = path.resolve(mossRoot, "src", "assets", "tournaments.json");
const tournamentsSourcePath = path.resolve(
  repoRoot,
  "apps",
  "website",
  "frontend",
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

async function generateRosterIndex(baseStatsDir) {
  if (!(await exists(baseStatsDir))) return;

  const entries = await readdir(baseStatsDir, { withFileTypes: true });
  const slugs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    if (slug === "rosters") continue;
    const fieldPath = path.resolve(baseStatsDir, slug, "field.json");
    if (await exists(fieldPath)) slugs.push(slug);
  }

  slugs.sort((a, b) => a.localeCompare(b));
  const indexPath = path.resolve(baseStatsDir, "rosters", "index.json");
  await writeJson(indexPath, { format: "moss_roster_index", version: 1, slugs });
  console.log(`[moss:sync-stats] Wrote ${path.relative(mossRoot, indexPath)} (${slugs.length} tournament(s))`);
}

async function syncStatsCopy() {
  if (!(await exists(sourceStatsDir))) {
    if (await exists(destStatsDir)) {
      await generateRosterIndex(destStatsDir);
    } else {
      console.warn(`[moss:sync-stats] No stats directory found at ${sourceStatsDir}; skipping stats sync.`);
    }
    return;
  }

  await generateRosterIndex(sourceStatsDir);

  await rm(destStatsDir, { recursive: true, force: true });
  await cp(sourceStatsDir, destStatsDir, { recursive: true });
  console.log(`[moss:sync-stats] Synced ${path.relative(repoRoot, sourceStatsDir)} -> ${path.relative(mossRoot, destStatsDir)}`);
}

async function syncMossTournamentIndex() {
  if (!(await exists(tournamentsSourcePath))) {
    if (!(await exists(mossTournamentsOutPath))) {
      await writeJson(mossTournamentsOutPath, { format: "moss_tournaments", version: 1, tournaments: [] });
      console.log(`[moss:sync-stats] Wrote ${path.relative(mossRoot, mossTournamentsOutPath)} (0 tournament(s))`);
    } else {
      console.warn(`[moss:sync-stats] Tournament source not found at ${tournamentsSourcePath}; leaving existing tournaments.json as-is.`);
    }
    return;
  }

  const raw = await readFile(tournamentsSourcePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`[moss:sync-stats] Unexpected tournaments.json shape; expected an array.`);
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
  console.log(`[moss:sync-stats] Wrote ${path.relative(mossRoot, mossTournamentsOutPath)} (${tournaments.length} tournament(s))`);
}

export async function main() {
  await syncMossTournamentIndex();
  await syncStatsCopy();
}

await main();

