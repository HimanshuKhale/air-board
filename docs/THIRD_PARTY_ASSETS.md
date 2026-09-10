# External assets and offline setup

Normal runtime uses only files served from localhost. npm installation and the first model download need internet.

| Asset | Original source | Local destination |
| --- | --- | --- |
| MediaPipe Tasks Vision JavaScript, version 0.10.32 | https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.32 | Bundled into public/vendor/hand-worker.js |
| SIMD WASM loader and binary | wasm/ directory of that npm package | public/vendor/mediapipe/vision_wasm_internal.js and .wasm |
| Non-SIMD loader and binary | wasm/ directory of that npm package | public/vendor/mediapipe/vision_wasm_nosimd_internal.js and .wasm |
| Hand Landmarker float16 model, version 1 | https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task | public/models/hand_landmarker.task |
| Favicon and UI icons | Original inline SVG created for this repository | public/favicon.svg and src/ui/icons.ts |

Model SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.

The setup script copies the npm package's WASM assets, verifies the pinned model hash, and records exact installed runtime hashes in public/asset-manifest.json. Runtime binaries are generated/downloaded assets ignored by Git. package-lock.json pins npm dependencies and their integrity hashes. Retain public assets or the built dist directory for offline use. Re-running setup with an intact cached model requires no model download.

MediaPipe's npm metadata declares Apache-2.0 for its runtime. Google publishes the trained model through the official model distribution. Review upstream terms before redistributing this as a commercial product; this file documents provenance and does not relicense upstream artifacts.

Implementation references:
- [Google Hand Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js): local model creation, VIDEO mode and worker guidance.
- [Official MediaPipe web sample worker](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/hand-landmarker.worker.ts): bitmap-based video inference.
- [MediaPipe source and license](https://github.com/google-ai-edge/mediapipe).
- [Vite guide](https://vite.dev/guide/): development and build setup.

No external images, icon fonts, web fonts or CDN scripts are used.
