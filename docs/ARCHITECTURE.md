# SAAI AirBoard architecture

## Boundaries and runtime

A Vite/TypeScript browser application with no backend, accounts, database, analytics or remote inference. Both routes serve the same entry point: `/` or `/studio` creates Studio; `/present` creates Presentation. Chrome/Edge on Windows with Web Locks, BroadcastChannel, Canvas, workers and getUserMedia is the supported MVP environment. All runtime URLs are same-origin localhost. Use one exact origin for both windows.

The drawing engine takes generic points and brush styles. It imports no MediaPipe types. The landmark adapter, gesture state machine, coordinate functions, rendering engine and synchronization protocol are independent modules.

## Camera pipeline and ownership

`CameraManager` requests video only, using the selected device, ideally 1280×720 at 30 FPS. Audio is never requested. Stop, disconnect, cancellation and page teardown stop tracks. Startup generations prevent a delayed permission response from resurrecting a stopped camera.

`CameraSession` holds the exclusive `saai-airboard-camera` Web Lock for the lifetime of capture. A Start Camera request tells the old owner to stop, then waits for the lock before calling getUserMedia. Opening Presentation from Studio with an active camera asks Presentation to acquire it. Studio releases capture, so there is only one webcam consumer within the app. Presentation also works directly, with its own camera selector and Start/Stop buttons.

Studio keeps synchronized settings and the drawing replica. When Presentation owns the camera, Studio shows the ownership status instead of a second live feed. Camera pixels are not relayed between windows. A camera-background export requested in Studio is delegated to the owner, and the download occurs in that window. Closing the owner stops capture; press Start Camera in a remaining window to restart deliberately.

If Presentation is minimized or its tab becomes hidden, browsers can throttle frames. The app disarms drawing on blur/visibility loss. Keep Presentation visible while teaching and screen-share that window.

## Tracking and performance

`HandTracker` sends a downscaled 640-pixel-wide ImageBitmap to a dedicated classic worker. It permits one in-flight frame, compares video.currentTime to avoid repeated frames, and adjusts scheduling from measured inference time (roughly 20–30 Hz on capable hardware; slower hardware is allowed to fall below this). Every transferred bitmap is closed in the worker, including errors. Initialization is bounded by a 30-second timeout.

The worker bundles MediaPipe's npm JavaScript into an IIFE at setup/build time. A **classic worker** is intentional: the selected Emscripten WASM loader uses importScripts, which is unavailable in module workers. The worker uses the CPU delegate to avoid depending on offscreen WebGL/driver compatibility. The actual selected build has been exercised in headless Edge: local model/WASM initialization and blank-frame inference pass. Real webcam accuracy and achievable FPS remain hardware tests.

MediaPipe Hand Landmarker runs in VIDEO mode with up to two hands and minimum detection, presence and tracking thresholds of 0.65. These are model configuration gates, not a displayed per-frame confidence score. The API exposes landmarks and handedness; handedness probability is not used as a substitute for detection confidence. Empty/invalid results, paused input, a >250 ms stale result, visibility loss, or a large point discontinuity produce pointer-up and disarm the gesture.

The display loop uses requestAnimationFrame independently of worker scheduling. Background video can redraw at display rate. Drawings redraw only when actions change. A cached committed canvas avoids replaying history on every pointer move. Metrics are in-memory one-second windows for render/tracking FPS and inference duration, shown only during local debug/calibration. No performance measurements leave the browser.

## Coordinates and smoothing

The logical board is always 1600×900 (16:9). CSS scales and letterboxes it without changing permanent stroke coordinates. This prevents resizing or moving between monitors from altering handwriting or export alignment.

Landmark 8 is the raw normalized index point. ExponentialFilter returns a separate smoothed normalized point. Alpha defaults to 0.6 at 30 Hz and is adjusted for elapsed time. It initializes at the first point and resets after loss/staleness, avoiding a slow slide from the origin. Its interface supports a future One Euro or Kalman implementation.

An optional four-point projective transform maps a convex camera-space quadrilateral to the unit board rectangle. The eight homography coefficients are solved with partial-pivot Gaussian elimination; calibration rejects crossed, concave, tiny, duplicate and numerically singular inputs. Stylus Assist replaces landmark 8 as the pointer source with a virtual nib: the thumb/index midpoint extended outward along the palm-center-to-pinch vector by 18% of mean palm scale. A saved two-dimensional board offset aligns that estimate to the user's physical pen tip.

The camera-to-canvas transform mirrors x when enabled, then applies the same contain/cover/stretch rectangle used by the background compositor. Cover may legitimately put points outside the board; they terminate drawing rather than clamp into edge streaks. Blank/image backgrounds use the full normalized hand range mapped to the board with stretch, independent of image fitting. Canvas-to-client and client-to-canvas functions account for the board's real bounding rectangle and CSS scale. Camera preview is mirrored consistently; export uses the same camera transform as the board.

## Pinch and input safety

Pinch ratio is the pixel-aspect-correct thumb-tip (4) to index-tip (8) distance divided by the average palm length (0–9) and palm width (5–17). This is invariant to uniform image-space hand scale and avoids applying a single raw normalized threshold to differently sized camera frames.

Defaults: enter at ratio ≤0.28 after 65 ms continuously closed; hold through the hysteresis band; release immediately at ≥0.42. The state machine emits hover, pinchStart, pinchHold and pinchEnd. Initial acquisition and every reset require an open hand before arming. A teacher returning already pinched cannot connect to an old stroke.

InputRouter turns mouse/touch and generic hand events into the same typed commands. A pinch is latched to either a UI control or a drawing stroke until release. UI hit-testing uses browser layout rather than guessed toolbar coordinates. A held pinch cannot repeatedly activate buttons or begin drawing after a toolbar click. Range inputs can be dragged; preset color/size buttons support hand input. Native file/color pickers and fullscreen can require trusted mouse/keyboard input due to browser restrictions.

Studio's drawing toolbar moves inside the board when the camera is local so the mapped hand can reach it. Presentation's toolbar occupies the board interior and can hide. The upper board edge or T reveals it. Mouse and keyboard remain available when hand input is paused.

## Interaction arbitration

`InteractionController` is the single dominant-hand arbitration layer. Its priority is: global two-hand toggle, active fist drag, active lasso, open-palm erase, pinch/stylus write, then hover. MediaPipe handedness selects the configured Left or Right manipulation hand; the other hand cannot start board actions.

Open-palm, index-only and fist poses use joint straightness plus wrist-relative fingertip distance, independent of screen-up orientation. Static entry is stabilized for 180 ms by default; open-palm erase uses the configurable 150â€“250 ms hold. Exit is immediate. Open palm anchors an eraser at the five-point palm center. Index-only records a lasso until it closes within the configured radius. A valid lasso needs at least 12 points, path length 180, area 1800, and sufficient closure; a strand is selected when its bounds intersect and at least 30% of its resampled points lie inside.

A stable fist inside/near a selection or within the configured segment-distance radius of the nearest drawable strand starts a drag. Frame updates affect only a local preview. Release commits one move action. Tracking loss cancels the preview. Two palm centers within the configured aspect-correct distance for 400â€“600 ms toggle hand control, with release-to-rearm and a 1.3-second cooldown.

## Drawing, history and layers

Four concepts are separated:

1. Background canvas (blank, fitted local image, or live video).
2. Transparent drawing canvas.
3. Transient landmark/debug overlay and pointer element.
4. DOM controls.

Pen and highlighter paths use midpoint quadratic interpolation, continuous paths, and round caps/joins. A tap is a dot. An active stroke is rendered as a single path each dirty frame, so overlapping samples do not repeatedly accumulate highlighter alpha. Highlighter uses 28% of configured opacity; separate passes may darken intentionally. Eraser uses destination-out and actually removes drawing alpha.

History stores points and style once per stroke, plus clear and move actions. One move stores selected IDs and a single x/y delta, preserving stroke IDs and brushes. Undo/redo move a history cursor and rebuild the committed cache. Eraser operations replay in order. A new committed action after undo truncates the redo branch. Clear is explicit and undoable. Active strokes and drag previews are not full-resolution bitmap histories.

## Window synchronization

A second exclusive Web Lock, `saai-airboard-board`, elects the command sequencer independently of camera ownership. BroadcastChannel carries schema-validated drawing/settings commands, ordered events and startup snapshots. A late-joining window receives background data, settings and full action/redo history. Replicas check epochs/revisions, ignore duplicates, and request a new snapshot on a gap. Lock handover lets another window continue from its local replica after the leader closes. A stale active stroke is finalized rather than bridged. The lock and message channel are scoped to one browser profile and origin.

UI controls update through the same reducer. Settings include tool/brush, background/image, mirror/fit/dimming, pinch calibration, pause and auto-hide. Debug toggles stay local to each window so Studio debugging does not expose diagnostics in the shared window. Camera status is a lightweight heartbeat, not video.

Commands carry unique request IDs and are acknowledged by the ordered event stream. Unacknowledged commands retry across leader handover; a bounded set of recent applied IDs accompanies snapshots to prevent duplicate undo/clear operations. Mouse press heartbeats keep a stationary held mouse stroke alive without storing redundant points. Hand-loss cancellation affects only hand-owned input, so a missing hand cannot interrupt mouse drawing.

A single active stroke is accepted at a time. Simultaneous hands/mouse in multiple windows are deliberately not collaborative drawing. This application is one teacher's local board.

## Export

The export compositor allocates a 1600×900 canvas. It draws the current background with the exact same fitting/mirroring/dimming routine, then the transparent drawing layer. It never samples the DOM or overlay canvas. Transparent export skips the background. Camera export captures the current video frame at the explicit save action; it is not video recording.

PNG encoding uses canvas.toBlob and a short-lived download URL. Filenames use local time, with a drawing suffix for transparency. Images are read by FileReader after type/size validation, retained as browser-local data URLs, and synchronized only within the same browser origin. Supported uploads: PNG/JPEG/WebP, ≤10 MB and ≤40 megapixels.

Image alignment is stored as horizontal/vertical fractions from 0 to 1, defaulting to center (0.5). The shared fit renderer applies those fractions to the available letterbox/crop distance. Center image restores defaults. Camera fitting stays centered. Stretch has no crop/letterbox distance, so position controls have no visual effect in stretch mode.

## Privacy and asset provenance

No API keys or external services. The page's content security policy restricts runtime resources to the app origin, with data/blob images and development-only localhost HMR WebSocket. Production preview has no HMR. Model/runtime sources and hashes are in `public/asset-manifest.json` and `docs/THIRD_PARTY_ASSETS.md`. Setup is the only model download; a pinned SHA-256 checks it. Runtime files are copied into public and then dist, never loaded from a CDN.

## Extension points

- Alternate pointer sources can emit generic board points/phases into InputRouter.
- PointerFilter can be replaced without changing MediaPipe or brush rendering.
- Optional gesture shortcuts can sit beside the authoritative pinch controller.
- BackgroundRenderer can add graph paper/grid providers using the same compositor.
- Stroke rendering/history can gain pressure, shapes and checkpoint caching.
- Board dimensions could become a session property, with explicit rescaling and protocol versioning.
- Durable board formats and session restore require an explicit future product decision; current exports are PNG only.
