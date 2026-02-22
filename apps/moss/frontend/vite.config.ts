import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";

function serveRepoStats(): Plugin {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const repoStatsDir = path.resolve(repoRoot, "stats");

    return {
        name: "moss-serve-repo-stats",
        apply: "serve",
        configureServer(server) {
            server.middlewares.use("/stats", async (req, res, next) => {
                if (!req.url) return next();
                if (req.method && req.method !== "GET" && req.method !== "HEAD") return next();

                const [rawPathname] = req.url.split("?", 1);
                const decodedPathname = decodeURIComponent(rawPathname);
                const candidatePath = path.resolve(repoStatsDir, `.${decodedPathname}`);

                const repoStatsPrefix = `${repoStatsDir}${path.sep}`;
                if (!candidatePath.startsWith(repoStatsPrefix)) return next();

                try {
                    const st = await stat(candidatePath);
                    if (!st.isFile()) return next();
                } catch {
                    return next();
                }

                const ext = path.extname(candidatePath).toLowerCase();
                if (ext === ".json") {
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
                }

                if (req.method === "HEAD") {
                    res.statusCode = 200;
                    res.end();
                    return;
                }

                res.statusCode = 200;
                createReadStream(candidatePath).pipe(res);
            });
        },
    };
}

export default defineConfig({
    plugins: [serveRepoStats(), react()],
});
