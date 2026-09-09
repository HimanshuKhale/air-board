# SAAI AirBoard - System Architecture

This document provides a comprehensive technical overview of **SAAI AirBoard** (`hand-sign-projection`), detailing its modular pipeline, mathematical models, state machines, and rendering engines.

---

## 1. High-Level System Architecture

The application is structured into decoupled, single-responsibility layers:

```
+-------------------------------------------------------------------------+
|                              SAAI AirBoard                              |
+-------------------------------------------------------------------------+
       |                                                 |
       v                                                 v
[ MediaStream / Camera ]                         [ HTMLCanvasElement ]
       |                                                 |
       v                                                 v
[ HandLandmarkerService ]                        [ DrawingEngine ]
  - Local WASM loader                              - Pen (source-over)
  - Local .task model                              - Highlighter (multiply/alpha)
  - GPU / CPU fallback                             - Eraser (destination-out)
       |                                           - Quadratic Bezier curves
       v                                                 ^
[ PinchDetector & Filter ]                               |
  - Distance normalization (0 to 9 palm scale)           |
  - Hysteresis state machine (start, hold, end)          |
  - One Euro Filter / EMA smoothing                      |
       |                                                 |
       v                                                 |
[ CoordinateTransformer ] -------------------------------+
  - Mirroring inversion
  - Viewport & Canvas scaling
       |
       v
[ HandPointerEvent ] (Generic Pointer Events)
       |
       +---> [ CanvasStage ]
       +---> [ CursorOverlay ]
       +---> [ BroadcastSyncService (Studio <-> Presentation) ]
```

---

## 2. Tracking & Vision Pipeline

### 2.1 Model & Runtime Vendoring
Rather than fetching binaries from external CDNs, the runtime bundles:
- `/public/models/hand_landmarker.task`: Quantized float16 Hand Landmarker model from Google MediaPipe.
- `/public/wasm/`: `vision_wasm_internal.js`, `vision_wasm_internal.wasm`, and SIMD variants.
- In `@mediapipe/tasks-vision`, `FilesetResolver.forVisionTasks('/wasm')` resolves all WASM files locally, achieving complete offline reliability.

### 2.2 Frame Throttle & Redundant Inference Prevention
Laptop webcams typically stream at 30 FPS. Running inference on every animation frame (60 FPS) wastes CPU/GPU cycles.
- SAAI AirBoard decouples the rendering loop (`requestAnimationFrame` at 60 FPS) from inference (throttled to 25–30 FPS).
- Redundant inference is prevented by inspecting `video.currentTime`. If the frame has not advanced, inference is skipped.

---

## 3. Coordinate Transformation Pipeline

The vision pipeline processes coordinates through four distinct spaces:

1. **Camera Normalized Space**: `(x, y)` in `[0.0, 1.0]`, where `(0,0)` is the top-left of the raw camera frame.
2. **Mirrored Camera Space**: Inverted along the X-axis:
   $$\text{mirroredX} = 1.0 - x$$
   This ensures directional naturalness: moving your physical hand to your left moves the on-screen cursor to the left.
3. **Viewport Pixel Space**: Screen coordinate computed as:
   $$\text{px} = \text{mirroredX} \times \text{viewportWidth}$$
   $$\text{py} = y \times \text{viewportHeight}$$
4. **Canvas Coordinate Space**: Internal high-DPI surface scaled by `devicePixelRatio` to prevent blurriness on Retina/4K displays.

---

## 4. Pinch Detection & Hysteresis State Machine

### 4.1 Palm-Scale Distance Invariance
Using a fixed raw pixel distance causes pinch detection to fail when the presenter steps closer to or further from the webcam.
SAAI AirBoard computes an **anatomical palm reference scale**:
- Distance between Landmark 0 (wrist) and Landmark 9 (middle finger metacarpophalangeal joint / knuckle).
- The normalized pinch distance is computed as:
  $$D_{\text{norm}} = \frac{\text{dist}(\text{Landmark}_4, \text{Landmark}_8)}{\text{dist}(\text{Landmark}_0, \text{Landmark}_9)}$$

### 4.2 Hysteresis State Machine
To prevent rapid flickering near the threshold, a dual-threshold state machine is enforced:
- **Engagement Threshold ($T_{\text{pinch}}$)**: Default `0.38`. When $D_{\text{norm}} \le T_{\text{pinch}}$, state transitions to `pinchStart` then `pinchHold`.
- **Release Threshold ($T_{\text{release}}$)**: Default `0.52`. The pinch is maintained during writing until $D_{\text{norm}} \ge T_{\text{release}}$, transitioning to `pinchEnd` then `idle`.

### 4.3 Gesture Safety
- If hand tracking confidence drops or the hand leaves the field of view, `pinchEnd` is fired immediately to terminate drawing.
- When the hand re-enters, filter states are reset so no connecting line is drawn from the previous position.

---

## 5. Pointer Stabilisation Filters

SAAI AirBoard incorporates two complementary smoothing filters:

1. **Exponential Moving Average (EMA)**:
   $$S_t = \alpha \cdot X_t + (1 - \alpha) \cdot S_{t-1}$$
   Configurable $\alpha \in [0.15, 0.85]$.
2. **1€ (One Euro) Filter**:
   An adaptive first-order low-pass filter (Casiez et al., CHI 2012). It dynamically adapts its cutoff frequency based on fingertip velocity:
   - At low speeds (fine handwriting): Low cutoff frequency eliminates micro-tremors.
   - At high speeds (rapid strokes): High cutoff frequency eliminates handwriting drag/lag.

---

## 6. Drawing Engine & Curves

### 6.1 Decoupled Architecture
The drawing engine is completely unaware of MediaPipe landmark types. It receives generic 2D coordinates and stroke commands.

### 6.2 Quadratic Bezier Curve Interpolation
Connecting raw frame points with straight lines creates faceted, angular strokes. SAAI AirBoard computes midpoints between consecutive samples and renders quadratic Bezier curves:
$$\text{midX} = \frac{p_1.x + p_2.x}{2}, \quad \text{midY} = \frac{p_1.y + p_2.y}{2}$$
$$\text{ctx.quadraticCurveTo}(p_1.x, p_1.y, \text{midX}, \text{midY})$$
This produces calligraphy-grade continuous strokes with round caps (`lineCap = 'round'`) and round joins (`lineJoin = 'round'`).

### 6.3 Tool Behaviors
- **Pen**: `globalCompositeOperation = 'source-over'`, opaque or customizable color.
- **Highlighter**: `globalCompositeOperation = 'source-over'`, fixed translucent opacity (0.35).
- **Eraser**: `globalCompositeOperation = 'destination-out'`. Erases pixels directly on the transparent drawing layer rather than painting background color. This ensures ink is erased cleanly without affecting camera or image backgrounds.

---

## 7. Visual Layer System

The screen is structured into four distinct layers:

1. **Layer 1: Background Surface**
   - Live camera `<video>` element with CSS mirror, dim, blur, and cover/contain fit.
   - Or local image loaded via browser `FileReader`.
   - Or blank whiteboard / blackboard / custom color.
2. **Layer 2: Drawing Layer**
   - Independent transparent `<canvas>` element holding ink strokes.
3. **Layer 3: Transient Cursor & Indicator Overlay**
   - High-contrast visual ring indicating pointer location, tool, brush radius, and pinch proximity.
   - Rendered at display refresh rate; **never drawn to the permanent canvas**.
4. **Layer 4: UI & Floating Toolbar**
   - Controls, calibration dialog, and debug overlays.

---

## 8. Export Compositing

When the presenter exports the board:
1. An off-screen canvas is created at the full resolution of the presentation surface.
2. If **Full Presentation** is chosen:
   - If Background is Camera: Current video frame is drawn onto the off-screen canvas, applying horizontal mirror transformation if enabled.
   - If Background is Image / Blank: Background image or color/grid is rendered.
3. The clean drawing layer is composited via `ctx.drawImage()`.
4. Overlays, cursors, debug metrics, and toolbars are omitted.
5. The result is exported as a PNG with filename `saai-airboard-YYYY-MM-DD-HHMMSS.png`.
6. Transparent PNG option exports the drawing layer in isolation.

---

## 9. Multi-Window Synchronization

Presenters often screen-share a clean window on a second monitor while keeping controls on their primary laptop screen.
- Synchronized via browser-native `BroadcastChannel` (`saai_airboard_broadcast_sync`).
- Messages broadcast tool selections, color changes, brush sizes, undo/redo triggers, and background states.
- Zero server, zero network sockets, zero latency.

---

## 10. Privacy Architecture

- Video streams exist solely in browser memory via `navigator.mediaDevices.getUserMedia()`.
- Video frames are never recorded or saved, except when the presenter manually triggers "Save PNG" while the Camera background is active.
- No network requests are made after initial page load.
- No analytics, telemetry, or external reporting tools are present.

---

## 11. Extension Points

1. **Additional Input Devices**: The decoupled `DrawingEngine` can accept mouse, stylus (with pressure sensitivity), touch, or Leap Motion controller inputs.
2. **Gesture Shortcuts**: Can incorporate MediaPipe Gesture Recognizer to recognize gestures like Open Palm (pause/hover), Victory sign (eraser), Pointing Up (pen), or Thumb Up (next slide).
3. **Teaching Backgrounds**: Graph paper, music staves, coordinate grids, and dotted grids can be plugged into `BackgroundManager`.
