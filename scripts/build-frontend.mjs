import { build, context } from "esbuild";
import { watch } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = resolve(rootDir, "src/frontend");
const publicDir = resolve(rootDir, "public");
const watchMode = process.argv.includes("--watch");
const staticFiles = [
  "choose.html",
  "index.html",
  "games.html",
  "rps.html",
  "telepathy.html",
  "guess-number.html",
  "charades.html",
  "shop.html",
  "records.html",
  "profile.html",
  "admin.html",
  "styles.css",
  "favicon.ico",
  "pixel-avatar.svg",
];

async function copyStaticAssets() {
  await mkdir(publicDir, { recursive: true });
  await Promise.all(staticFiles.map((file) => copyFile(resolve(frontendDir, file), resolve(publicDir, file))));
}

const buildOptions = {
  bundle: true,
  entryPoints: [resolve(frontendDir, "app.ts")],
  format: "esm",
  logLevel: "info",
  outfile: resolve(publicDir, "app.js"),
  platform: "browser",
  sourcemap: true,
  target: ["es2022"],
};

await copyStaticAssets();

if (!watchMode) {
  await build(buildOptions);
  process.exit(0);
}

const buildContext = await context(buildOptions);
await buildContext.watch();

const staticWatcher = watch(frontendDir, (_eventType, filename) => {
  if (!filename) {
    return;
  }

  if (!staticFiles.includes(filename)) {
    return;
  }

  copyStaticAssets().catch((error) => {
    console.error("Failed to copy static assets:", error);
  });
});

console.log("Watching frontend sources...");

process.on("SIGINT", async () => {
  staticWatcher.close();
  await buildContext.dispose();
  process.exit(0);
});
