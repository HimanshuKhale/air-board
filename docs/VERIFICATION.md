# Verification record

Latest verification completed on 2026-09-19 in the supplied Windows workspace.

## Completed checks

- Node 22.22.0, TypeScript 5.9.3, Vite 7.3.6, Vitest 4.1.11, Playwright 1.63.0, MediaPipe Tasks Vision 0.10.32.
- Initial npm install downloaded dependencies and the versioned model.
- A clean npm ci --offline using the populated local npm cache succeeded, including cached-model checksum verification and local worker bundling.
- Dependency installation audit: zero reported vulnerabilities.
- Strict TypeScript typecheck: passed.
- Vitest: **93/93 unit tests passed across 10 files**.
- Vite production build: passed; 51 modules transformed, app entry 157.25 kB JavaScript / 49.87 kB gzip, excluding separately served local model/WASM assets.
- Playwright, installed Microsoft Edge in headless mode, production preview: **21/21 tests passed**.
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
12. Hand-input mode, Pen Writing offset and four-point plane preferences persist locally and reset through UI controls.
13. Synthetic physical-right landmarks acquire and resize a selected native shape through the real controller.
14. Confident rectangles and circles convert immediately without the legacy approval prompt; digit 2 becomes native text; undo/redo restores rough/clean forms.
15. Destructive voice clear uses a separate pending YES/NO confirmation and leaves the board unchanged after NO.

Pure unit coverage additionally verifies direct raw-to-physical handedness, complementary writing/confirmation roles, geometric poses, pen-grip down/up/rearming/interruption/mode changes, four-fingertip lasso entry/release hysteresis and pen-grip rejection, open-palm erase history, homography, selection, shape transforms, atomic multi-stroke replacement, two-hand priority and virtual nib/offset geometry.

Digit fixture measurement: **20/20** transformed single-stroke fixtures were recognized, consisting of two generated variants for each digit 0–9. The two supplied multi-stroke fixtures, one 4 and one 5, were also recognized (**2/2**). Explicit transformed comparisons keep the supplied 6/9 and 3/8 fixtures distinct, and Mixed-mode tests retain 0/circle, 1/line and 4/triangle collisions as ink. These deterministic synthetic fixtures check implementation coverage and are not a general handwriting accuracy claim; natural variation still requires real-user evaluation.

Browser request monitoring during ordinary board interaction and the synthetic-camera workflow observed no external HTTP(S) app requests. Synthetic tests do not use the laptop's real webcam or save its imagery.

## Not verified on real hardware

Actual webcam permission prompt/device selection, real physical-right/left label verification, hand-role stability with preview mirror on/off, Pen Writing grip reliability, physical pen alignment, four-fingertip lasso reliability and fallback need, natural handwriting/digit accuracy, two-hand proximity comfort, calibrated physical-plane accuracy, achievable tracking/render FPS, second-monitor fullscreen, and live meeting-app screen sharing.

Use MANUAL_TEST_CHECKLIST.md to record those results before teaching. Automated blank/synthetic frames demonstrate runtime integration, not successful recognition of a real hand.

## Generated artifacts

Production files: dist/.
Local model: public/models/hand_landmarker.task.
Local runtime/worker: public/vendor/.
Automated screenshots: test-results/studio.png and test-results/presentation.png (test artifacts, ignored by Git).

No separate lint configuration was introduced. TypeScript enforces strict types and unused-code checks. Source files are present in a newly initialized local Git repository; no remote has been configured or code published.
