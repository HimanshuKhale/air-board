# Real-camera acceptance checklist

**Status: implemented; real webcam acceptance has NOT been performed by the coding agent.** Automated tests exercise pure logic, browser UI, the local model/WASM worker, and synthetic video where stated. They do not establish recognition accuracy, latency, lighting tolerance or monitor behavior on your laptop.

Record laptop/CPU, Windows version, Chrome/Edge version, webcam, lighting, date, resolution, measured tracking/render FPS and pass/fail notes. Do not record/export camera footage unless you intend to.

## Installation and local-only operation
- [ ] In a fresh folder with Node 22.12+, run npm.cmd install, then npm.cmd run dev. Open http://127.0.0.1:5173.
- [ ] Build with npm.cmd run build and serve with npm.cmd run preview. Disconnect internet while retaining the localhost server; reload and repeat camera startup, drawing and export.
- [ ] Inspect DevTools Network in production preview. All app/model/WASM requests are to 127.0.0.1; no intentional external requests. There is no analytics, login or API-key setup.
- [ ] On a second launch with cached assets, npm.cmd run setup:assets succeeds offline.

## Camera and hand acquisition
- [ ] Start Camera requests camera permission and shows the selected camera.
- [ ] Deny permission, confirm helpful error, and confirm mouse drawing still works. Allow permission and retry.
- [ ] Select another available webcam; stop/start and verify the chosen device.
- [ ] Move one open hand into view; a pointer appears near the index fingertip.
- [ ] With Camera background and Mirror enabled, left/right movement matches the mirrored feed. Disable Mirror and confirm pointer and video change together.
- [ ] Repeat with contain, cover, different board/window sizes and another monitor. Pointer alignment remains consistent, including letterboxing/cropping.
- [ ] Stop Camera turns off the device light. Unplugging the camera produces a useful status and stops drawing.

## Pinch, safety and handwriting
- [ ] Hover with an open hand: no marks.
- [ ] Bring thumb/index together for a deliberate pinch: the pointer engages.
- [ ] Pinch and move with Pen: continuous rounded strokes, including slow letters and fast curves.
- [ ] Release: drawing stops immediately.
- [ ] Vary distance to camera; normalize-based pinch remains usable. Adjust optional calibration if needed.
- [ ] Wiggle around the closed threshold; it does not rapidly toggle.
- [ ] Lose hand visibility mid-stroke: drawing stops. Re-enter already pinched: no drawing. Open, then pinch: a new stroke starts without a connecting line.
- [ ] Move rapidly or show a second hand: check that unexpected hand switches do not create long lines. Use one hand for reliable MVP operation.
- [ ] Pause hand input (Space or button): gestures stop, while mouse/touch remain usable.
- [ ] Change focus, minimize, or switch tabs mid-stroke: no lingering press when you return.

## Controls and tools
- [ ] Mouse, touch (if supported), and hand pinch activate Pen, Highlighter, Eraser, preset colors and preset sizes.
- [ ] Studio's toolbar moves inside the board when local hand control is active.
- [ ] A pinch on a control activates once. Holding then moving off the control does not begin a stroke.
- [ ] Custom color, size slider and opacity controls work with mouse. Hand sliders can be dragged; use mouse/keyboard for native OS file/color dialogs.
- [ ] Highlighter is translucent with uniform opacity along one pass; a second pass may darken.
- [ ] Eraser removes drawing alpha. Change background afterward: erased regions show the new background.
- [ ] Undo/redo pen, highlighter and eraser; create a new stroke after undo and verify redo resets.
- [ ] Clear requires its button; undo restores the board.

## Backgrounds, exports and visual layers
- [ ] Whiteboard, blackboard and custom colors work.
- [ ] Load local PNG, JPG/JPEG and WebP; check contain, cover and stretch. Adjust horizontal/vertical image position and reset with Center image. Image stays local.
- [ ] Camera background renders with mirror, fit and dimming controls.
- [ ] Save PNG with blank/image backgrounds. Open the downloaded 1600×900 file and compare pixels/orientation.
- [ ] Save with Camera background and mirror both on/off; export matches current video, including dimming/cropping.
- [ ] Export excludes cursor, hand skeleton, toolbar, metrics and welcome hints.
- [ ] Drawing-only PNG has transparency and retains pen/highlighter/erasing.

## Studio / Presentation
- [ ] Open Presentation from Studio with a running camera. Studio releases its stream and shows camera-in-Presentation status. Only one camera consumer remains.
- [ ] Studio tool/color/size/background/clear/undo/redo changes appear in Presentation.
- [ ] Open Presentation after some drawing; history and current background arrive.
- [ ] Open /present directly with Studio closed; Start Camera and all essential tools work.
- [ ] Close Studio while Presentation remains open; continue drawing and history operations.
- [ ] Close the camera owner; another window can explicitly Start Camera. No unwanted automatic capture.
- [ ] Request a camera export in Studio while Presentation owns capture; the PNG downloads in Presentation.
- [ ] Move Presentation to the second monitor; use F/fullscreen button and Escape.
- [ ] Tools auto-hide. Top board edge and T reveal them. Gesture toolbar hit-testing remains aligned at different window sizes.
- [ ] Share only Presentation in Meet/Zoom/Teams/OBS. Confirm learners see a clean board. Debug is off by default and stays local to each window.

## Calibration and performance
- [ ] Calibration shows detected hand, raw/smoothed coordinates, pinch phase/ratio and thresholds.
- [ ] Smoothing adjusts response; defaults restore sensible behavior.
- [ ] On the target laptop, record tracking FPS, render FPS and inference duration. Check handwriting lag during a 10-minute teaching simulation.
- [ ] Repeat in typical classroom lighting, with your usual background, at normal hand distance.
- [ ] Test a longer teaching session, many strokes, undo and export. Watch memory/performance.
- [ ] Save before closing the last app window: session drawings are intentionally memory-only.
