# Fist manipulation and precision cutting gateway

## Why the previous live gestures were replaced

The prior controller only armed Scale or Rotate after the user selected the matching contextual mode, then required thumb and index to remain constrained while middle, ring and pinky stayed inside a narrow mid-extension band. Cut used a different whole-hand edge classifier, required palm-normalized travel of 0.5 at velocity 0.0016/ms, counted repeated chops, and waited 1.3 seconds before equal subdivision. These conditions were implemented and synthetic tests passed, but the live controls were hard to enter and Cut represented a piece count rather than a position. The old modules remain for compatibility tests and are not routed from live hand input.

## Fist acquisition and transform

The configured dominant anatomical hand owns manipulation. A native-object selection is required. A fist must be within the configured grab radius of selected geometry and remain stable for the acquisition hold (220 ms by default). Acquisition stores deep copies of the objects, their IDs, the mapped palm/knuckle anchor, apparent hand size, projected orientation, and the shared selection pivot. Translation begins at zero, so objects do not jump to the hand.

Every preview is derived from that immutable baseline in this order:

1. Uniform scale around the shared selection pivot.
2. Image-plane rotation around the same pivot.
3. Board-space translation from the initial mapped anchor.

The modes are Move Only, Move + Scale, Move + Rotate, and Full Manipulation. Opening the fist for 90 ms commits one `transform-objects` action when geometry changed. Tracking loss, camera loss, pause, calibration, confirmation, or a mode change discards the preview. A stale source baseline is rejected by history. Undo restores the exact baseline and Redo restores the exact final geometry.

## Relative depth and rotation

Depth is a relative monocular estimate. It is the median of aspect-correct wrist-to-index/middle/ring/pinky MCP distances and the index-to-pinky MCP span. The acquisition measurement is the neutral baseline. A bounded linear response uses the configured near/far apparent sizes and sensitivity, with a neutral dead zone and a 25–400% safety range.

Measurements with excessive dispersion, a frame-to-frame jump above 18%, or a size jump above 8% while orientation changes more than 12 degrees are ambiguous. Scaling freezes at its last reliable value while translation continues. **Capture fist far** and **Capture fist near** store observed apparent sizes locally; they do not measure physical distance.

Projected rotation uses the aspect-correct index-to-pinky MCP axis. Relative angle is unwrapped through ±180 degrees, smoothed, and subjected to the configured rotation dead zone. It represents rotation in the camera image plane, not arbitrary 3D wrist roll.

## Scissor recognition and guide

Cut mode must be visibly armed and exactly one eligible native object selected. Only the dominant hand is routed to the scissor controller.

- Index and middle extension scores must be at least 0.60.
- Ring and pinky scores must be at most 0.40.
- Thumb extension must be at most 0.70.
- Open separation is at least 0.34 palm units.
- Closed separation is at most 0.20 palm units.
- Open scissors stabilize for 180 ms; a closed transition stabilizes for 55 ms.

The explicit states are `IDLE`, `OPEN_SCISSORS`, `GUIDE_ACTIVE`, `SNIP_DETECTED`, `COMMITTED`, and `WAITING_FOR_REOPEN`. A stationary V never reaches the closed threshold. Loss of the required two-extended/two-folded articulation cancels. One accepted close transition can create at most one cut, and reopening is required before another.

The guide passes through the mapped midpoint of the index and middle fingertips. Its direction is perpendicular to the projected axis from the midpoint of the index/middle MCPs to the fingertip midpoint. The green/red line is the exact infinite line passed to geometry. At snip acceptance, that line is frozen. Mouse, touch, and tablet users can enter Cut, press at the desired point, drag to set direction, and choose **Apply Cut**.

## Positional cut geometry

`cutObject(source, line)` is separate from equal subdivision.

| Source | Result |
| --- | --- |
| Line | Exact segment/guide intersection; two collinear line objects. Near-endpoint and parallel/missing intersections are rejected. |
| Arrow | Same split; only the terminal piece keeps the arrowhead. |
| Triangle | World geometry clipped against both line half-planes. Results may be triangle plus quadrilateral. |
| Rectangle, square, convex native polygon | World geometry, including rotation, clipped into two native polygons. |

Area must reconstruct the source within `max(2 board px², source area × 1e-5)`. Each polygon piece must exceed both 100 board px² and 1% of source area. Misses, tangencies, boundary cuts, non-finite geometry, self-intersections, degenerate pieces, and concave sources are rejected.

Circles, ellipses, freehand strokes, text, and connectors are unsupported. Objects referenced by connectors are blocked. No raster fallback is used.

## History, synchronization, and priority

`cut-object` contains the exact source baseline, frozen normalized line, and two fixed output objects/IDs. It removes the source, adds both pieces, and clears selection in one reducer transaction. Duplicate delivery and stale sources cannot add duplicate pieces. BoardChannel request IDs preserve retry and leader failover protection. Guide and piece previews remain local.

Pending confirmation and global two-hand pause/calibration have priority. An active physical stylus/tablet stroke blocks new fist or scissor acquisition. An acquired fist owns the dominant hand until release or cancellation. An active scissor guide blocks writing, erasing, lasso, and grabbing for that hand. Complementary-hand confirmations and M6 reactions retain their existing roles.

Synthetic tests validate the math and controller transitions. Real webcam stability, lighting tolerance, mirrored preview behavior, occlusion recovery, and near/far calibration remain hardware acceptance work.
