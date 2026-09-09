# SAAI AirBoard (`hand-sign-projection`)

**SAAI AirBoard** is a contactless, hand-controlled digital whiteboard engineered for educators, mentors, trainers, and presenters. By tracking hand gestures via an ordinary laptop webcam, SAAI AirBoard turns your hand into a responsive pointer and drawing controller—enabling smooth handwriting, highlighting, erasing, and canvas interactions without physically touching a mouse, screen, or drawing tablet.

---

## Key Features

- **Pinch-to-Draw Interaction**: Uses your index fingertip (Landmark 8) as the pointer and the thumb-to-index pinch gesture as the click/draw trigger.
- **Distance-Invariant Pinch**: Distance is normalized against the presenter's palm size (wrist to middle knuckle), ensuring pinch sensitivity remains consistent whether you are sitting close to or far from your camera.
- **Hysteresis State Machine**: Dual-threshold (`pinchStart` / `pinchHold` / `pinchEnd`) state machine eliminates rapid jitter and false triggers.
- **Low-Latency Pointer Smoothing**: Integrated 1€ (One Euro) Filter and Exponential Moving Average (EMA) to eliminate hand tremors without causing handwriting drag.
- **Multiple Background Surfaces**:
  - **Live Webcam Feed**: Present over your mirrored live camera feed with optional dimming, soft blur, and fit modes.
  - **Uploaded Local Image**: Display slides, worksheets, diagrams, or documents (processed strictly inside the browser, never uploaded).
  - **Blank Board**: Whiteboard, Blackboard, or custom color with optional grid patterns.
- **Pixel-Erasing Engine**: Eraser operates via `destination-out` composite operations, wiping drawing-layer ink cleanly without painting over dynamic or camera backgrounds.
- **Pristine Export PNG**: Exports full composite (background + ink) or drawing-only transparent PNGs with automated timestamped filenames (`saai-airboard-YYYY-MM-DD-HHMMSS.png`), strictly excluding toolbars, cursors, and debug overlays.
- **Dual Application Modes**:
  - **Studio Mode (`/`)**: Comprehensive setup workspace with camera selection, live preview, calibration sliders, and presentation launcher.
  - **Presentation Mode (`/present`)**: Minimalist, distraction-free view with auto-hiding floating controls designed for second monitors and video conference screen sharing (Google Meet, Zoom, Teams, OBS).
- **Client-Side Multi-Window Synchronization**: Local `BroadcastChannel` synchronizes tools, colors, sizes, and actions across Studio and Presentation windows without any backend or WebSocket server.
- **100% Local & Privacy-Preserving**: No server backends, no cloud APIs, no analytics, and zero runtime CDN dependencies.

---

## Quick Start for Windows

### Prerequisites

- **Node.js** (v18.0.0 or higher recommended, including v20 or v22 LTS)
- **npm** (v9+ or v10+)
- A standard laptop or USB webcam

### Windows Installation & Startup

Open **PowerShell** or **Command Prompt** in Windows:

```powershell
# 1. Navigate to the project folder
cd hand-sign-projection

# 2. Install dependencies (if not already installed)
npm install

# 3. Start local development server
npm run dev
```

The terminal will report:
```
  VITE v6.2.3  ready in 250 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://0.0.0.0:3000/
```

Open your browser to:
- **Studio Mode**: [http://localhost:3000/](http://localhost:3000/)
- **Presentation Mode**: [http://localhost:3000/?mode=present](http://localhost:3000/?mode=present) or [http://localhost:3000/present](http://localhost:3000/present)

---

## Provenance of External Assets

All machine learning models and WebAssembly binaries are **100% locally vendored** in the `/public` directory so the application operates completely offline without external CDNs:

| Asset | Local Location | Source Provenance |
|---|---|---|
| **Hand Landmarker Model** (`hand_landmarker.task`) | `/public/models/hand_landmarker.task` | Official Google MediaPipe Models Repository (`https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`) |
| **Vision WASM Module** (`vision_wasm_internal.js`, `.wasm`) | `/public/wasm/` | `@mediapipe/tasks-vision` npm package (`node_modules/@mediapipe/tasks-vision/wasm/`) |
| **SIMD & No-SIMD WASM Binaries** | `/public/wasm/` | `@mediapipe/tasks-vision` npm package |

---

## Core Interaction Guide

| Action | Physical Gesture | Mouse Fallback |
|---|---|---|
| **Move Pointer / Hover** | Move hand with open fingers | Move mouse across screen |
| **Draw (Pen / Highlighter)** | Pinch thumb tip and index fingertip together & move | Click and drag primary mouse button |
| **Erase** | Switch to Eraser tool, pinch thumb & index, and move | Select Eraser, click and drag mouse |
| **Activate Toolbar Control** | Hover cursor over button and tap pinch | Click button with mouse |
| **Select Color / Size** | Hover over palette swatch and tap pinch | Click swatch with mouse |
| **Stop Drawing** | Open hand / release pinch | Release mouse button |

---

## Keyboard Shortcuts

| Shortcut | Description |
|---|---|
| `P` | Switch to **Pen** |
| `H` | Switch to **Highlighter** |
| `E` | Switch to **Eraser** |
| `Ctrl + Z` / `Cmd + Z` | **Undo** last stroke |
| `Ctrl + Y` / `Ctrl + Shift + Z` | **Redo** previously undone stroke |
| `F` | Toggle **Fullscreen** mode |
| `Escape` | Exit Fullscreen mode |
| `D` | Toggle **Diagnostics / Telemetry Overlay** |
| `T` | Toggle Toolbar visibility (Presentation Mode) |

---

## Automated Unit Testing

Run the Vitest test suite covering coordinate transformation, pinch normalization, hysteresis, pointer smoothing filters, history stacks, export filenames, and multi-window message schemas:

```bash
npm test
```

To run a production build verification:
```bash
npm run build
```

---

## Privacy Notice

**Camera processing happens strictly on this device.** Video streams are never recorded, transmitted, or uploaded to any remote server or third-party service. When using Camera Background, the current video frame is only captured into memory at the exact moment the presenter explicitly clicks "Save Image / Export PNG".
