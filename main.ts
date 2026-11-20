// Vice City Cover Studio — entry program.
//
// Copies the static app (app/) and the screenshots (screenshots/) into an
// output directory, then writes dossier.json there using the vendored
// make.fun library. The output directory comes from MAKEFUN_OUTPUT_DIR
// when set, and defaults to /output.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

const appDir = join(repoRoot, "app");
const shotsDir = join(repoRoot, "screenshots");

mkdirSync(outDir, { recursive: true });

if (existsSync(appDir)) {
  cpSync(appDir, join(outDir, "app"), { recursive: true });
}
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });
}

const dossier = buildDossier(repoRoot, {
  screenshotsDir: shotsDir,
  text_max_bytes: 163840,
  screenshots_max_files: 4,
  screenshots_max_bytes_each: 262144,
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_max_path_bytes: 1000,
});

// buildDossier returns the dossier bytes (a Uint8Array) or a string;
// either way, write them verbatim so dossier.json matches byte for byte.
const dossierBytes =
  typeof dossier === "string" ? dossier : Buffer.from(dossier);
writeFileSync(join(outDir, "dossier.json"), dossierBytes);

console.log(`Vice City Cover Studio handed in to ${outDir}`);
