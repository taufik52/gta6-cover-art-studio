import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Resolve the repository root from this file's own location.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The output directory comes from the environment, defaulting to /output.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outputDir, { recursive: true });

// Copy the app and screenshots folders into the output when they exist.
for (const folder of ['app', 'screenshots']) {
  const src = join(repoRoot, folder);
  if (existsSync(src)) {
    cpSync(src, join(outputDir, folder), { recursive: true });
  }
}

// Build the dossier for this repository and write it out verbatim.
// The builder may hand back a string or raw bytes, so normalise both
// to a Buffer before writing.
const dossier = buildDossier(repoRoot, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
const dossierBytes =
  typeof dossier === 'string' ? Buffer.from(dossier, 'utf8') : Buffer.from(dossier);

writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);

console.log(`Dossier written to ${outputDir}/dossier.json (${dossierBytes.length} bytes)`);
