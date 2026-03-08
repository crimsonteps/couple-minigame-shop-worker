import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(rootDir, "dist");

await mkdir(distDir, { recursive: true });

await build({
  bundle: true,
  entryPoints: [resolve(rootDir, "src/index.ts")],
  external: ["better-sqlite3", "ws"],
  format: "esm",
  logLevel: "info",
  outfile: resolve(distDir, "server.js"),
  platform: "node",
  sourcemap: true,
  target: ["node22"],
});
