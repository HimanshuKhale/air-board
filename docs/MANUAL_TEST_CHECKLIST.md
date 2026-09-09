# SAAI AirBoard - Hardware Acceptance & Manual Test Checklist

This checklist corresponds directly to the 28 manual acceptance requirements specified for the **SAAI AirBoard** (`hand-sign-projection`) MVP. Perform these tests using a physical webcam on your laptop or desktop.

---

| # | Scenario / Requirement | Verification Steps | Pass / Fail | Notes |
|---|---|---|---|---|
| **1** | **Startup on localhost** | Run `npm install` and `npm run dev`. Navigate to `http://localhost:3000/`. Studio workspace loads without errors. | [ ] | |
| **2** | **Start Camera Permission** | Click **"Start Camera"** in the sidebar. Browser requests permission; video feed appears in Studio preview. | [ ] | |
| **3** | **Hand Landmark Detection & Cursor** | Raise your hand in front of the camera. The on-screen pointer appears centered near your index fingertip (Landmark 8). | [ ] | |
| **4** | **Natural Mirrored Movement** | Move physical hand to the left. Confirm cursor moves to the left on-screen (natural presenter perspective). | [ ] | |
| **5** | **Pinch Engagement** | Bring thumb tip and index fingertip together. Cursor ring tightens and displays active drawing state. | [ ] | |
| **6** | **Pinch & Move Drawing (Pen)** | With Pen selected, pinch thumb and index together and move hand across the canvas. A continuous, smooth stroke appears. | [ ] | |
| **7** | **Pinch Release Stops Drawing** | Release thumb and index apart. Stroke stops immediately without trailing dots. | [ ] | |
| **8** | **Hover Without Drawing** | Move hand with open fingers across canvas. Cursor tracks position without laying down ink. | [ ] | |
| **9** | **Loss of Tracking Safety** | While drawing a stroke, move hand completely out of the camera's view. Current stroke terminates cleanly. | [ ] | |
| **10** | **Reacquiring Hand Without Connecting Line** | Reintroduce hand into frame on the opposite side of the screen. Confirm no connecting line is drawn from the old position. | [ ] | |
| **11** | **Color Selection** | Click color picker on toolbar; choose Ink Blue or Crimson. Draw a stroke; color matches selection. | [ ] | |
| **12** | **Brush Size Selection** | Select Medium (8px) or Thick (16px) or use the slider. Next stroke renders at the selected thickness. | [ ] | |
| **13** | **Highlighter Tool** | Select Highlighter (H). Draw over an existing pen stroke. Verify strokes are semi-transparent and readable underneath. | [ ] | |
| **14** | **Eraser Tool** | Select Eraser (E). Erase across existing strokes. Drawing pixels disappear cleanly without leaving a solid colored patch. | [ ] | |
| **15** | **Undo Action** | Click Undo (or press `Ctrl+Z`). The most recent stroke disappears. | [ ] | |
| **16** | **Redo Action** | Click Redo (or press `Ctrl+Y` / `Ctrl+Shift+Z`). The undone stroke reappears in exact order. | [ ] | |
| **17** | **Clear Board** | Click Clear button; confirm clear. All strokes on the board vanish. | [ ] | |
| **18** | **Local Image Background** | Select Background -> Image. Choose a local PNG/JPG file. Image loads as canvas background; drawing stays on top. | [ ] | |
| **19** | **Camera Background** | Select Background -> Live Webcam Feed. Mirrored video displays behind your transparent drawing canvas. | [ ] | |
| **20** | **Blank Board Presets** | Select Background -> Whiteboard, then Blackboard. Background changes instantly while preserving existing ink. | [ ] | |
| **21** | **Presentation Fullscreen** | In Presentation View (`/present`), click Fullscreen button or press `F`. Board expands to full screen. | [ ] | |
| **22** | **Clean Screen Sharing View** | Verify `/present` has no clunky borders, headers, or persistent sidebars. Suitable for screen sharing in Google Meet / Zoom / Teams. | [ ] | |
| **23** | **Dual Input (Mouse & Gestures)** | Draw and click toolbar buttons using both mouse and hand pinch gestures interchangeably. | [ ] | |
| **24** | **Export PNG Pristine Output** | Click "Save PNG". Open downloaded image. Confirm drawing + background are present, but cursor, toolbar, and debug data are excluded. | [ ] | |
| **25** | **Export with Camera Background** | With Camera Background active, export PNG. Confirm current webcam frame is composited with ink. | [ ] | |
| **26** | **Export Orientation Match** | Confirm exported camera frame matches the mirrored orientation seen during live presentation. | [ ] | |
| **27** | **Offline & Zero Network Calls** | Disconnect internet / toggle browser DevTools Offline. Confirm hand tracking and drawing continue working locally without errors. | [ ] | |
| **28** | **Documentation Verification** | Verify `README.md`, `docs/ARCHITECTURE.md`, and this checklist accurately describe the application. | [ ] | |
