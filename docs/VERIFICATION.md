# Verification record

Verified on 2026-09-10 in the supplied Windows workspace.

## Completed checks

- Node 22.22.0, TypeScript 5.9.3, Vite 7.3.6, Vitest 4.1.11, Playwright 1.63.0, MediaPipe Tasks Vision 0.10.32.
- Initial npm install downloaded dependencies and the versioned model.
- A clean npm ci --offline using the populated local npm cache succeeded, including cached-model checksum verification and local worker bundling.
- Dependency installation audit: zero reported vulnerabilities.
- Strict TypeScript typecheck: passed.
- Vitest: **17/17 unit tests passed**.
- Vite production build: passed; app entry ~49.5 kB JavaScript / ~16.2 kB gzip, excluding separately served local model/WASM assets.
- Playwright, installed Microsoft Edge in headless mode, production preview: **8/8 tests passed**.
- Documented npm run dev startup: Vite successfully serves http://127.0.0.1:5173.

## Browser coverage

1. Mouse drawing, real destination-out erasing, undo/redo, undoable clear, PNG download and dimensions.
2. Uniform highlighter alpha, local image upload, image positioning and centering reset, transparent drawing export.
3. Late-join board snapshots, cross-window settings/history synchronization and sequencer failover.
4. Real local classic-worker initialization, model/WASM loading and blank-frame inference.
5. Actionable camera permission-denial UI with mouse drawing still available.
6. Presentation auto-hide and keyboard reveal.
7. Synthetic canvas video through the camera/tracker pipeline, uninterrupted mouse drawing while no hand is detected, exclusive Studio-to-Presentation camera transfer, and camera export requested from Studio. PNG pixels verify mirrored orientation, dimming, background-before-ink compositing and opaque dimensions.
8. Real generic hand-input router driven by test events: hover produces no stroke, pinch draws/releases, input loss ends strokes, toolbar activation is latched once and cannot spill into drawing.

Browser request monitoring during ordinary board interaction and the synthetic-camera workflow observed no external HTTP(S) app requests. Synthetic tests do not use the laptop's real webcam or save its imagery.

## Not verified on real hardware

Actual webcam permission prompt/device selection, hand accuracy, handwriting feel, pinch reliability across distances and lighting, achievable tracking/render FPS, physical mirror alignment, second-monitor fullscreen, and live meeting-app screen sharing.

Use MANUAL_TEST_CHECKLIST.md to record those results before teaching. Automated blank/synthetic frames demonstrate runtime integration, not successful recognition of a real hand.

## Generated artifacts

Production files: dist/.
Local model: public/models/hand_landmarker.task.
Local runtime/worker: public/vendor/.
Automated screenshots: test-results/studio.png and test-results/presentation.png (test artifacts, ignored by Git).

No separate lint configuration was introduced. TypeScript enforces strict types and unused-code checks. Source files are present in a newly initialized local Git repository; no remote has been configured or code published.
