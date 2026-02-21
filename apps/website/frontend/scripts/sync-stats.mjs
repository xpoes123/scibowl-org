import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const websiteRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(websiteRoot, "..", "..", "..");

const sourceStatsDir = path.resolve(repoRoot, "stats");
const destStatsDir = path.resolve(websiteRoot, "public", "stats");

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
  console.log(`[website:sync-stats] Wrote ${path.relative(websiteRoot, indexPath)} (${slugs.length} tournament(s))`);
}

async function syncStatsCopy() {
  if (!(await exists(sourceStatsDir))) {
    if (await exists(destStatsDir)) {
      await generateRosterIndex(destStatsDir);
    } else {
      console.warn(`[website:sync-stats] No stats directory found at ${sourceStatsDir}; skipping stats sync.`);
    }
    return;
  }

  await generateRosterIndex(sourceStatsDir);

  await rm(destStatsDir, { recursive: true, force: true });
  await cp(sourceStatsDir, destStatsDir, { recursive: true });
  console.log(`[website:sync-stats] Synced ${path.relative(repoRoot, sourceStatsDir)} -> ${path.relative(websiteRoot, destStatsDir)}`);
}

export async function main() {
  await syncStatsCopy();
}

await main();

