# SAAI AirBoard

A local hand-controlled teaching whiteboard for Windows. Pinch to draw, open a palm to erase, point to lasso, form a fist to move strokes, and bring two hands together to pause or resume hand control. Mouse and touch work alongside hand input.

Built with Vite, TypeScript, Canvas and MediaPipe Hand Landmarker. Core drawing and gestures remain local. An optional loopback Node speech service can transcribe microphone segments; it is separate from camera and board processing. No React, database, authentication, analytics or runtime CDN.

## Run on this laptop

Prerequisites: Node.js **22.12 or newer** and a current **Microsoft Edge or Google Chrome**. Node 22.22.0 and headless Edge were used for automated verification.

Open PowerShell:

```powershell
cd E:\SAAI_AirBoard\hand-sign-projection
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Studio is also at /studio; Presentation is at /present. Use the same exact origin in both windows: localhost and 127.0.0.1 are different origins. The server binds only to loopback.

The .cmd form works with PowerShell's default script restrictions; in Command Prompt, npm install and npm run dev work too. No execution-policy change is needed.

This delivery is a local repository folder, not a published Git remote. If you later clone it, replace the first line with cd into your clone's hand-sign-projection directory, then run the same commands. For an exact locked dependency reinstall use npm.cmd ci.

Install automatically:
1. Installs npm dependencies.
2. Copies the MediaPipe WASM loaders/binaries into public/vendor/mediapipe.
3. Downloads and verifies the versioned hand model into public/models.
4. Bundles a local classic inference worker.

The first setup needs internet. Afterward runtime works offline while the localhost server is running. No model download occurs when the cached checksum matches. Do not open index.html directly using file://.

## AirBoard Intelligence V1

Smart Shapes is on by default. Draw a rough line, square, rectangle, parallelogram, trapezoid, pentagon, hexagon, polygon, circle, ellipse, triangle or arrow with mouse, touch or pinch. A translucent clean preview appears for eight seconds, exactly five seconds longer than the original window. Choose **✌️ YES** to replace the rough stroke with an editable native object, or **🤙 NO** to keep the ink. During that window, hold a V sign with the anatomical left hand to approve or a shaka sign to reject; the hold duration is configurable from 300–500 ms. The gesture must be released before it can answer another request. Mouse and touch buttons remain available. Undo after conversion restores the original stroke. Settings can disable suggestions or enable delayed automatic conversion for high-confidence matches. Small marks, highlighter and eraser strokes are excluded; geometry alone cannot reliably distinguish a large handwritten O from a circle, so automatic conversion is off by default.

Native objects include all shapes listed above plus text and connectors. Open **Shapes** to create one directly. A selected shape shows handles: **Scale** provides whole-shape controls, **Points** exposes polygon vertices and edges, and **Proportional/Free** chooses the resize constraint. Drag handles with mouse or touch, or pinch them with the anatomical right hand. Lines and arrows expose endpoints; circles and ellipses expose radii. Each completed transform produces one undo entry, while tracking loss cancels its preview. Multiple selected objects can still move together with fist drag or Shift-drag as one history action.

Two-hand scaling is intentionally deferred. The existing two-hand pose is the global pause/resume safety control, and reusing it for scaling would make accidental mode changes likely. Right-hand pinch on visible handles supplies the required gesture scaling without weakening that safety boundary.

Voice commands need an explicit **Commands** mode. Open **Voice** in either window. Typed commands work without the speech service. To test transcription locally, start a second PowerShell terminal:

```powershell
cd E:\SAAI_AirBoard\hand-sign-projection
npm.cmd run ai:mock
```

Click **Start microphone** to grant audio permission. The mock service returns a fixed transcript for testing. For live speech, copy `.env.example` to `.env`, set `AIRBOARD_STT_PROVIDER=openai` and `OPENAI_API_KEY` in that server-only file, then run `npm.cmd run ai` instead of `ai:mock`. `.env` is ignored by Git. The browser sends five-second audio segments only while listening; with OpenAI selected, the local service forwards those segments to OpenAI. Interim text is displayed, while only final text can change the board. Stop microphone to cancel requests and release audio tracks. No camera frame, screenshot or whole-board image is sent.

Say or type: `AirBoard, ek rectangle banao`, `AirBoard, teen boxes banao`, or `AirBoard, create a flowchart with data collection, model training and deployment`. Select a box and use Command Mode for `Is box ko database naam do`; named boxes can be connected, recolored, moved or resized. Clear requires confirmation. The deterministic command parser recognizes a bounded English, Hindi and Hinglish vocabulary; unrecognized or ambiguous phrases leave the board alone. Automatic speech-to-diagram is present as a tested planning scaffold but deliberately disabled in the UI. Real Hindi/Hinglish microphone accuracy remains to be tested on your equipment.

The optional Node service binds only to `127.0.0.1:8787`, caps input at 512 KB per segment, allows 12 requests per minute and 100 per day by default, and times out after 15 seconds. `AIRBOARD_DAILY_REQUEST_LIMIT` can lower the daily cap. It does not provide a monetary hard cap; set a project spending limit with the provider. The selected `gpt-transcribe` model is listed at about **US$0.0045 per audio minute** in [OpenAI's model documentation](https://developers.openai.com/api/docs/models/gpt-transcribe); 100 five-second segments would be about US$0.038, assuming each segment is five seconds. The service keeps counters in memory, so restarting it resets them. Core drawing works with the service stopped.

## Production/offline serving

```powershell
npm.cmd run build
npm.cmd run preview
```

Open **http://127.0.0.1:4173**. The production build includes the model, WASM and worker. Keep dist and installed tooling on the laptop. Stop the server with Ctrl+C. All processing stays on this device; the localhost static server does not receive camera frames.

To repair missing assets:

```powershell
npm.cmd run setup:assets
npm.cmd run setup:worker
npm.cmd run build
```

## Teach with AirBoard

1. Choose a camera in Studio, then Start camera and allow browser access.
2. Choose the dominant hand in Settings. Open it once before the first pinch and after tracking loss.
3. Pinch with the dominant hand to draw. Hold an open palm briefly to erase, trace a closed loop with only the index extended to select, or hold a fist near a stroke/selection to drag it.
4. Bring both palm centers close for about half a second to pause or resume hand input. Separate them before toggling again. Mouse and touch remain available while paused.
5. Optionally calibrate a four-corner physical writing plane or choose Stylus Assist and calibrate its virtual nib offset.
6. Select a white/black/custom board, local image, or camera background. Image/camera fit supports contain, cover and stretch; camera supports mirroring and dimming.
7. Open Presentation, move it to your teaching monitor, and screen-share that window. Press F for fullscreen.
8. Save PNG for background + drawing, or Drawing only for transparent PNG.

Studio and Presentation share drawing history and settings through the browser. When Presentation takes the camera, Studio shows its status instead of opening a second preview. Studio remains a control panel. A camera-background export from Studio downloads in the camera-owning window. You can use /present alone; its Settings and Background buttons expose setup controls.

The Presentation toolbar hides after inactivity; move to the **top edge of the board** or press T to reveal it. Studio's toolbar moves inside the board while its camera is active, making it reachable by the hand pointer. Preset colors/sizes are pinch-friendly. Native file/color pickers and fullscreen may require a trusted mouse click or key press. Clear is an explicit button and is undoable; no gesture shortcut clears the board.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| P | Pen |
| H | Highlighter |
| E | Eraser |
| Ctrl+Z | Undo |
| Ctrl+Y or Ctrl+Shift+Z | Redo |
| F | Toggle fullscreen |
| Escape | Leave fullscreen / close a dialog |
| T | Reveal Presentation controls |
| Space | Pause/resume hand input (mouse stays usable) |

Shortcuts do not intercept typing in form fields or settings dialogs. Ctrl also supports the platform Meta key for undo/redo.

## Calibration

Calibration is optional. Defaults are mirror on, EMA response 0.6, close ratio 0.28, release ratio 0.42 and close debounce 65 ms. The pinch ratio compares tip distance to palm size, with camera aspect correction. Lower pointer response adds smoothing; higher response follows the finger more quickly.

Writing-plane calibration captures Top Left, Top Right, Bottom Right and Bottom Left in normalized camera space, validates a convex non-degenerate quadrilateral, and computes a projective homography to the 1600Ã—900 board. Hand settings and calibration points are stored locally. Stylus Assist estimates a nib from the thumb/index midpoint and palm orientation; it does not detect the physical pen or use another model.

Calibration shows hand detection, raw/smoothed coordinates, pinch ratio/phase, and local FPS/inference timing. The red debug dot is raw; green is smoothed. Hand Landmarker uses configured detection/presence/tracking thresholds of 0.65. It does not expose a useful per-frame detection confidence value, so the UI does not invent one. Reset calibration restores defaults without clearing your drawing.

Debug is off by default and local to each window. Closing calibration removes its overlay. Debug, cursor and controls never appear in PNG export.

## Verification commands

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:ui
```

The browser suite uses installed Microsoft Edge in **headless** mode and serves the production build automatically at port 4173. Run build before test:ui after changing code. It needs no real webcam: permission denial and synthetic video are explicitly supplied by tests. If Edge is absent, install it or change the Playwright channel in playwright.config.ts to chrome for an installed Chrome.

Unit tests cover gesture geometry and timing, homography, lasso selection, nearest-segment grabs, move undo/redo, two-hand debounce/cooldown, Stylus Assist geometry, frame transport and existing drawing behavior. Browser tests cover Canvas output, synchronization, camera ownership, synthetic video, worker/model/WASM execution and a local known-hand fixture.

**Automated passes do not mean your webcam has been validated.** Complete [docs/MANUAL_TEST_CHECKLIST.md](docs/MANUAL_TEST_CHECKLIST.md) before a class, especially pinch reliability, tracking loss/reacquisition, mirror alignment, latency, camera switching, second-monitor fullscreen, screen sharing and offline operation. No separate lint configuration is present; strict TypeScript checks include unused code.

The original baseline passed 54 unit tests and 12 headless Edge integration tests. Current results are reported in the development handoff. See [docs/VERIFICATION.md](docs/VERIFICATION.md), [camera diagnostics](docs/CAMERA_PIPELINE_DIAGNOSTICS.md), and the [M2â€“M5 design record](docs/M2_M5.md).

## Privacy

> Camera processing happens locally on this device. Video is not uploaded or recorded.

Audio capture occurs only after **Start microphone**. With the optional OpenAI service configured, audio segments are sent to OpenAI for transcription. The camera and board stay local. No video recording, frame persistence, external telemetry or cloud account is built into AirBoard. Only an intentional camera-background export saves a webcam frame as part of your PNG. Images and drawing state remain in browser memory and are shared only across this application's same-origin windows. Setup downloads packages/model; ordinary drawing runtime requests only localhost assets.

See [asset provenance](docs/THIRD_PARTY_ASSETS.md) and public/asset-manifest.json for original URLs, pinned model checksum and runtime hashes.

## Limitations and troubleshooting

- **Memory-only sessions:** closing/reloading the final window loses editable drawing history and uploaded images. Save PNG before closing. Opening another window receives the existing session. There is no editable board import/autosave in this MVP.
- **Landmark visibility:** use even lighting and keep the manipulating hand visible. Two hands are used only for the global pause/resume gesture. A 250 ms stale-tracking watchdog cancels in-flight hand interactions safely.
- **Camera unavailable:** allow camera access through the browser address-bar icon. Close another app using the webcam, reconnect it, select the device, and retry. Start in another AirBoard window deliberately transfers ownership.
- **Camera in Presentation:** this is expected. Studio does not duplicate or relay camera pixels. Start Camera in Studio transfers capture back. Closing the owner does not automatically restart the camera elsewhere.
- **Lag:** keep Presentation visible, improve lighting, and try a different webcam. The CPU worker is adaptive; 20–30 tracking FPS is a target, not a hardware guarantee. Background browser tabs may be throttled. Mouse input remains available.
- **Controls change tool size:** selecting Pen, Highlighter or Eraser chooses practical defaults (6, 24, 48 logical pixels); adjust Size afterward.
- **Long sessions:** vector history grows in memory; undo replays committed actions. A single held stroke accepts up to 12,000 points; release and begin another stroke for unusually long holds.
- **Export:** fixed 1600×900 PNG, matching the logical 16:9 board. Camera export needs an active camera; image export needs a loaded image. Export does not include screen-share UI. This is not an OS-wide pointer or slide-control tool.
- **Popup blocked:** allow localhost popups, or open /present directly and start its camera.
- **Missing model/worker:** rerun setup:assets and setup:worker, then rebuild. No silent remote-CDN fallback exists.
- **Port in use:** stop the previous dev/preview server. Ports 5173 and 4173 are strict so windows do not accidentally join different origins.
- **npm resolver crash:** .npmrc uses legacy-peer-deps to avoid an npm 10 optional-peer resolution crash observed during setup. The committed lockfile records the verified dependency tree.
- **Offline does not mean no server:** keep the local Vite/preview process running. There is no service worker or installed PWA.

## Exact module inventory

| Files | Responsibility |
| --- | --- |
| src/main.ts, src/styles.css | Application composition, render loop, design tokens and layout |
| src/core/types.ts, settings.ts, coordinates.ts | Generic board types, defaults and coordinate spaces |
| src/camera/manager.ts, session.ts | Devices/stream lifecycle and exclusive camera ownership |
| src/tracking/hand.worker.ts, tracker.ts | MediaPipe worker and throttled frame scheduler |
| src/input/, src/interaction/ | Pinch machine, smoothing, pointer routing, geometric poses, central arbitration, two-hand toggle and Stylus Assist |
| src/calibration/, src/selection/ | Homography/local calibration persistence and lasso/nearest-stroke geometry |
| src/drawing/history.ts, engine.ts | Stroke/clear/move history, live move previews and transparent rendering |
| src/background/renderer.ts | Local images, blank/video backgrounds and fitting |
| src/export/compositor.ts | UI-free PNG composition and download |
| src/sync/protocol.ts, channel.ts | Validated state reducer, BroadcastChannel and leader election |
| src/debug/metrics.ts | In-memory performance counters |
| src/ui/studio.ts, presentation.ts, toolbar.ts, dialogs.ts, controls.ts, overlay.ts, icons.ts | Modular views, accessible controls and temporary diagnostics |
| scripts/setup-assets.mjs, build-worker.mjs | Local model/WASM setup and classic-worker bundling |
| tests/unit/core.test.ts, tests/browser/app.spec.ts, camera.spec.ts, hand-input.spec.ts | Logic, browser UI, synthetic camera and generic hand-input integration tests |
| public/favicon.svg, public/asset-manifest.json | Original favicon and generated asset hashes |
| package.json, package-lock.json, .npmrc, .gitignore | Commands, dependency lock and setup configuration |
| index.html, tsconfig.json, vite.config.ts, playwright.config.ts | HTML/CSP, strict TypeScript, Vite/Vitest and browser tests |
| README.md, docs/ARCHITECTURE.md, docs/THIRD_PARTY_ASSETS.md, docs/MANUAL_TEST_CHECKLIST.md, docs/VERIFICATION.md | Setup, design decisions, provenance, hardware acceptance and verification evidence |

Detailed design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
