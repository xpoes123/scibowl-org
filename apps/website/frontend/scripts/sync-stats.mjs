import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, rm, stat } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const websiteRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(websiteRoot, "../../..");

const sourceStatsDir = path.resolve(repoRoot, "stats");
const destStatsDir = path.resolve(websiteRoot, "public", "stats");

const main = async () => {
  try {
    await stat(sourceStatsDir);
  } catch {
    console.warn(`[sync-stats] No stats directory found at ${sourceStatsDir}; skipping.`);
    return;
  }

  await rm(destStatsDir, { recursive: true, force: true });
  await cp(sourceStatsDir, destStatsDir, { recursive: true });
  console.log(`[sync-stats] Synced ${sourceStatsDir} -> ${destStatsDir}`);
};

await main();

