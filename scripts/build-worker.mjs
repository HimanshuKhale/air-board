import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const asset of ['models/hand_landmarker.task', 'vendor/mediapipe/vision_wasm_internal.js', 'vendor/mediapipe/vision_wasm_internal.wasm', 'vendor/mediapipe/vision_wasm_nosimd_internal.js', 'vendor/mediapipe/vision_wasm_nosimd_internal.wasm']) {
  try { await access(path.join(root, 'public', asset)); }
  catch { throw new Error('Missing local asset: ' + asset + '. Run npm run setup:assets before starting or building.'); }
}
await build({
  absWorkingDir: root, entryPoints: ['src/tracking/hand.worker.ts'],
  outfile: 'public/vendor/hand-worker.js', bundle: true, format: 'iife',
  platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof',
});
console.log('Classic inference worker bundled locally.');
