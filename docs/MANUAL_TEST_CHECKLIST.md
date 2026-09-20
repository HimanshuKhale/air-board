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
- [ ] Open Debug, raise only the physical right hand, and use **Verify physical Right**. Confirm Debug shows `raw Right -> physical Right`, a confidence score, writing role Right and confirmation role Left. Repeat with **Verify physical Left**. Toggle preview Mirror off/on and confirm these roles never swap.
- [ ] In Finger mode, hover with an open physical right hand: no marks. Pinch and move: continuous rounded strokes. Release stops immediately. The physical left hand never draws, erases, lassos, drags or resizes.
- [ ] In Pen Writing, hold an ordinary pen naturally. Release the grip once, then hold the thumb/index/middle three-point grip for the configured interval. Confirm the indicator changes from `P↑`/UP to `P`/DOWN and ink follows the estimated virtual nib without an ordinary pinch.
- [ ] Release the Pen Writing grip to lift/reposition with no connecting line. Lose tracking mid-stroke and return still gripping: no ink starts until a release and fresh stable grip. Switch modes mid-stroke and confirm the same rearming rule.
- [ ] Vary distance and orientation. Confirm the pen grip is distinct from the five-tip lasso cluster. Record false starts/missed releases; the physical pen tip and surface contact are not detected.
- [ ] Pause hand input (Space or button): gestures stop, while mouse/touch remain usable.
- [ ] Hold the dominant hand open for about 200 ms: the palm-centered eraser appears at its real diameter and erases continuously until the pose changes.
- [ ] Bring the physical right index, middle, ring and pinky fingertips to the thumb and hold for the configured interval. Trace a sufficiently large closed loop with the five-tip centroid and confirm enclosed strokes and native objects show selection bounds. Relax slightly to check hysteresis; open fully to release. A pen grip must not start lasso. If the camera cannot resolve the cluster reliably, select the documented Index-only fallback and record that result.
- [ ] Form a fist near the selection, drag, and release. Undo moves it back in one step; redo reapplies it. With no selection, only the nearest strand inside the grab radius moves.
- [ ] Start lasso/erase/drag, then hide the hand. The action stops or cancels and does not bridge when the hand returns.
- [ ] Bring two palm centers close for about 500 ms while idle. Confirm a pause toast, no hand drawing/erase/lasso/grab, and working mouse/touch. Confirm an active shape transform or left-hand confirmation has priority. Separate and rejoin after cooldown to resume without continuing an old action.
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
- [ ] Calibrate the writing plane in Top Left, Top Right, Bottom Right, Bottom Left order using a visibly skewed physical quadrilateral. Check corners and interior points map to the rectangular board; reload and confirm persistence.
- [ ] Try duplicate, crossed, tiny, or concave corner placement and confirm calibration is rejected; reset and recalibrate.
- [ ] Choose Pen Writing, align the intended virtual nib point to the center target, release once, then hold the three-point grip. Verify estimated nib/ink alignment, persistence after reload, and reset. The pen itself and physical contact are not detected.
- [ ] In Debug, compare camera preview with Worker Input Preview. Verify dimensions, nonuniform opaque RGB pixels, advancing frame IDs, successful inference timestamps, raw-to-physical handedness, handedness score, writing/confirmation roles, per-hand gesture, lasso/selection/grab state, plane state, pen UP/DOWN and virtual nib.
- [ ] Calibration shows detected hand, raw/smoothed coordinates, pinch phase/ratio and thresholds.
- [ ] Smoothing adjusts response; defaults restore sensible behavior.
- [ ] On the target laptop, record tracking FPS, render FPS and inference duration. Check handwriting lag during a 10-minute teaching simulation.
- [ ] Repeat in typical classroom lighting, with your usual background, at normal hand distance.
- [ ] Test a longer teaching session, many strokes, undo and export. Watch memory/performance.
- [ ] Save before closing the last app window: session drawings are intentionally memory-only.

## Left-hand reactions

- [ ] With Right selected as the writing hand, hold a clear physical-left thumbs-up for about 260 ms. Confirm exactly one 👍 appears near the left hand, remains anchored, and disappears after about 2.5 seconds. Keep holding past the animation and confirm it does not repeat until release and a fresh hold.
- [ ] Draw continuously with the physical right hand while triggering the left thumbs-up. Confirm the stroke remains continuous in Studio and Presentation and Undo still contains only the drawing action.
- [ ] Test the finger-heart classifier at several distances, hand rotations and lighting levels. Compare a Korean finger heart against an ordinary thumb-index pinch, Pen Writing grip and five-tip lasso. Record false positives and false negatives before treating this mapping as classroom-ready; 21 landmarks do not directly measure finger crossing or depth contact.
- [ ] Enable the optional V and shaka reaction slots. With no confirmation pending, verify their chosen emoji mappings. Start a pending confirmation and confirm physical-left V means YES, shaka means NO, and neither produces an emoji.
- [ ] Bring both palm centers inside the pause proximity while beginning a reaction. Confirm reaction candidacy stops before pause/resume activates. Confirm paused hand control never emits reactions.
- [ ] Open Reaction Settings in Studio. Disable reactions and confirm right-hand writing still works. Change slot emojis, intensity and duration, reload, and confirm the local preferences persist. Restore defaults and verify finger heart, V and shaka return to disabled.
- [ ] Use each Studio preview and verify the same event type and board position appears once in Presentation. Open a late Presentation window after the effect expires and confirm it does not replay.
- [ ] Trigger several reactions and export both PNG variants while one is visible. Confirm reactions, hand overlays and reaction previews are absent from the files. Close either window during an effect and confirm the remaining window cleans up normally.
- [ ] Enable the operating system reduced-motion preference. Confirm reactions remain briefly visible and fade without floating or scaling.

## Spatial transform and subdivision gateway

- [ ] Connect the normal drawing pad/stylus. Draw before, during and after hand tracking is enabled; tablet pointer input remains available and is never converted into a three-finger or chop gesture.
- [ ] Select one native shape and choose Scale. With the physical dominant hand, constrain thumb/index and hold middle/ring/pinky in a mid-range pose for the configured interval. Open those three fingers to grow and curl them to shrink. Confirm the live percentage is stable, release commits one undo step, and tracking loss cancels the preview.
- [ ] Select two or more native objects and repeat Scale. Confirm their shared center remains fixed, relative layout is preserved, one Undo restores every original geometry, and one Redo reproduces the exact result.
- [ ] Choose Rotate and reacquire the three-finger pose. Rotate the hand in the camera image plane across the ±180° boundary; confirm the angle does not jump. Verify lines, arrows, rectangles, triangles, polygons and ellipses render, select, lasso, resize and export at their rotated geometry.
- [ ] Confirm transform mode never activates with no selected native object. While a transform is active, try fist, open palm, lasso, Pen Writing and a left-hand reaction; only the selected transform owns the manipulating hand. Pause, change mode, stop camera or hide the hand and confirm the baseline returns unless release explicitly committed.
- [ ] Select a line, choose Cut, and make three deliberate hand-edge swipes with a return/release between them. Confirm feedback reads Cut count 1, 2 and 3, a three-piece preview appears, and inactivity commits exactly three equal-length independently selectable segments.
- [ ] Make one chop and wait. Confirm the original remains unchanged. Try slow repositioning, tremor and held/repeated frames; none count as extra chops. Use Cancel during a preview and verify the original remains.
- [ ] Subdivide a triangle into three pieces. Measure or inspect vertices and confirm equal area through one edge split to the opposite vertex; do not describe the three pieces as similar. Test the separate four-piece Similar construction.
- [ ] Divide a rectangle and a convex polygon into 2–12 equal-area regions. Undo restores the exact source; redo restores the same piece IDs and geometry in Studio and Presentation.
- [ ] Rotate a line before subdivision and confirm all segments remain collinear and cover the original. For an arrow, confirm only the terminal piece retains the arrowhead.
- [ ] Confirm circles, ellipses, text, freehand strokes, concave/invalid polygons and connectors stay unchanged with a clear unsupported message. Confirm a shape referenced by a connector cannot be subdivided; transforming the shape keeps the connector attached to updated geometry.
- [ ] Use contextual 80%/125%, ±15°, and 2/3-piece controls with mouse, touch and tablet stylus. Confirm these commands use the same atomic history and synchronization path as gestures.

## Intelligence V1: real microphone and webcam acceptance

- [ ] With the AI service stopped, draw, pinch, erase, undo and export normally. Typed commands in Commands mode still work.
- [ ] In Shapes mode, draw a large rough rectangle and circle with mouse, touch and Finger/Pen Writing separately. Confirm confident candidates convert immediately with no prompt; one Undo restores rough ink and Redo restores the native shape. Try handwriting O, A, D and small notes; uncertain marks remain ink.
- [ ] Select a converted shape by lasso and by Shift-click; move it by fist and Shift-drag. Erase it with open palm and mouse eraser; one Undo restores the shape. Confirm freehand erasing still reveals a changed background.
- [ ] Start `npm.cmd run ai` with a real server-side key, then choose Commands and click Start microphone. Deny permission once and confirm a useful error. Retry and confirm only the microphone indicator turns on; camera ownership is unchanged.
- [ ] Say English, Hindi and Hinglish phrases, including “AirBoard, ek rectangle banao”, “AirBoard, teen boxes banao”, “AirBoard, create a flowchart with data collection, model training and deployment”, and Hindi with English technical terms. Check transcript fidelity and that interim text never creates objects.
- [ ] Select a box; try “Is box ko database naam do”, “Ye arrow red kar do”, “Connect the API to the database”, and “Ab model training ke neeche deployment add karo”. Check that ambiguous references cause a message instead of the wrong edit.
- [ ] Move a generated box and confirm its connector follows. Undo the entire generated diagram in one step. Open Presentation late, then close Studio during a pending transcription; confirm one diagram only.
- [ ] Say clear board and verify confirmation is required. Try repeated transcripts and verify no duplicate objects. Stop microphone; confirm the browser microphone indicator turns off and no more audio requests occur.
- [ ] Disconnect the speech service or internet mid-session. Confirm board content remains, pen and webcam control continue, and no cloud request contains camera frames, screenshots or the whole board.
- [ ] Save board and transparent PNGs containing native shapes and labels. Verify Presentation output and your actual screen-sharing setup.
- [ ] Review provider usage and spending limit after a live trial. Automatic mode should remain unavailable in the UI.

## Smart recognition and advanced shape editing

- [ ] In Digits mode, write 0 through 9 in several natural styles. Confirm confident results become editable native text in the selected color and at approximately the written position/size. Test two-stroke 4 and 5 within and outside the 450 ms grouping window; unrelated nearby strokes must not merge.
- [ ] In Mixed mode, test 0/circle, 1/line, 4/triangle, 6/9 and 3/8. Confirm the first three explicit collisions and other low-margin candidates remain ink rather than guessing.
- [ ] Trigger a separate pending confirmation if one is available. Only then, hold a physical-left V for YES or shaka for NO for the configured 300–500 ms. Confirm the pose must rearm and the right hand remains available for board manipulation. Both-hands pause must not steal the pending confirmation.
- [ ] Create each palette shape: triangle, square, rectangle, parallelogram, trapezoid, pentagon, hexagon, arbitrary polygon, circle, ellipse, line and arrow. Confirm Studio/Presentation synchronization and PNG export.
- [ ] Select one shape. Drag Scale handles with mouse/touch and right-hand pinch in Proportional and Free modes. Confirm live preview, board/minimum bounds, one Undo per completed transform, and cancellation on tracking loss.
- [ ] In Points mode, move polygon vertices and edge handles. Confirm invalid self-intersections are rejected. Move line/arrow endpoints and circle/ellipse radius handles.
- [ ] Select multiple objects and fist-drag or Shift-drag the group. Confirm one move action and correct undo/redo round trip.
