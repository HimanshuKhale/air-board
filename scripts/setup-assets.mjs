import { mkdir, readdir, copyFile, readFile, writeFile, stat, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const modelPath = path.join(root, 'public/models/hand_landmarker.task');
const modelSha256 = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const wasmDir = path.join(root, 'public/vendor/mediapipe');
await mkdir(path.dirname(modelPath), { recursive: true });
await mkdir(wasmDir, { recursive: true });
const source = path.join(root, 'node_modules/@mediapipe/tasks-vision');
const version = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')).version;
const assets = [];
for (const name of await readdir(path.join(source, 'wasm'))) {
  if (!/\.(wasm|js)$/.test(name)) continue;
  await copyFile(path.join(source, 'wasm', name), path.join(wasmDir, name));
  assets.push({ file: `vendor/mediapipe/${name}`, sha256: createHash('sha256').update(await readFile(path.join(wasmDir, name))).digest('hex') });
}
let present = false;
try { present = (await stat(modelPath)).size > 1_000_000 && createHash('sha256').update(await readFile(modelPath)).digest('hex') === modelSha256; } catch { /* first setup */ }
if (!present) {
  console.log('Downloading the versioned Hand Landmarker model (setup only)…');
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Model download failed: ${response.status}. Retry npm run setup:assets with internet access.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== modelSha256) throw new Error('Model checksum did not match the pinned version. Refusing to install it.');
  if (bytes.length < 1_000_000 || bytes[0] !== 0 || bytes[1] !== 0 || bytes[2] !== 80 || bytes[3] !== 75) {
    // Task archives can have a short alignment prefix or start directly with ZIP magic.
    if (!bytes.subarray(0, 8).includes(Buffer.from('PK')) || bytes.length < 1_000_000) throw new Error('Unexpected model download; refusing to install it.');
  }
  await writeFile(`${modelPath}.tmp`, bytes);
  await rename(`${modelPath}.tmp`, modelPath);
}
assets.push({ file: 'models/hand_landmarker.task', source: modelUrl, sha256: createHash('sha256').update(await readFile(modelPath)).digest('hex') });
await writeFile(path.join(root, 'public/asset-manifest.json'), JSON.stringify({ runtime: `@mediapipe/tasks-vision@${version}`, source: `https://www.npmjs.com/package/@mediapipe/tasks-vision/v/${version}`, assets }, null, 2) + '\n');
console.log('Local model and WASM assets ready. Normal runtime needs no internet.');
