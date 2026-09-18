# Verification record

Verified on 2026-09-10 in the supplied Windows workspace.

## Completed checks

- Node 22.22.0, TypeScript 5.9.3, Vite 7.3.6, Vitest 4.1.11, Playwright 1.63.0, MediaPipe Tasks Vision 0.10.32.
- Initial npm install downloaded dependencies and the versioned model.
- A clean npm ci --offline using the populated local npm cache succeeded, including cached-model checksum verification and local worker bundling.
- Dependency installation audit: zero reported vulnerabilities.
- Strict TypeScript typecheck: passed.
- Vitest: **54/54 unit tests passed**.
- Vite production build: passed; app entry ~93.2 kB JavaScript / ~29.1 kB gzip, excluding separately served local model/WASM assets.
- Playwright, installed Microsoft Edge in headless mode, production preview: **12/12 tests passed**.
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
9. Portrait frame transport preserves orientation and nonblank opaque pixels, while invalid frames and successful zero-hand inference produce distinct outcomes.
10. An official local two-hand fixture returns two 21-point landmark arrays through both normalized-canvas and direct-bitmap comparison paths at the original 0.65 thresholds.
11. Debug preview/threshold controls and landmark overlay operate locally and reset when disabled.
12. Hand-input mode, Stylus Assist offset and four-point plane preferences persist locally and reset through UI controls.

Pure unit coverage additionally verifies geometric pose classification, temporal entry/exit, dominant-hand filtering, open-palm erase history, homography/inverse/degeneracy, lasso geometry, nearest-segment hit testing, one-action moves with undo/redo, two-hand hold/rearm/cooldown, and virtual nib/offset geometry.

Browser request monitoring during ordinary board interaction and the synthetic-camera workflow observed no external HTTP(S) app requests. Synthetic tests do not use the laptop's real webcam or save its imagery.

## Not verified on real hardware

Actual webcam permission prompt/device selection, real hand recognition through the selected Galaxy/other camera, pose reliability, handwriting feel, physical stylus alignment, two-hand proximity comfort, calibrated physical-plane accuracy, achievable tracking/render FPS, physical mirror alignment, second-monitor fullscreen, and live meeting-app screen sharing.

Use MANUAL_TEST_CHECKLIST.md to record those results before teaching. Automated blank/synthetic frames demonstrate runtime integration, not successful recognition of a real hand.

## Generated artifacts

Production files: dist/.
Local model: public/models/hand_landmarker.task.
Local runtime/worker: public/vendor/.
Automated screenshots: test-results/studio.png and test-results/presentation.png (test artifacts, ignored by Git).

No separate lint configuration was introduced. TypeScript enforces strict types and unused-code checks. Source files are present in a newly initialized local Git repository; no remote has been configured or code published.
