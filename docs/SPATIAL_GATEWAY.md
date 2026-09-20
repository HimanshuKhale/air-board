# Spatial transform and subdivision gateway

## Geometry model

`BoardObject.rotation` is an optional image-plane angle in radians around the object's center. Existing objects without the property behave as rotation zero. Object `x`, `y`, `width`, `height`, and optional absolute `vertices` remain the editable local geometry; rendering, hit testing, lasso selection, handles, selection bounds, connectors, and export resolve that geometry into world points through the same rotation helper.

Group scaling and rotation use one selection-bounds center. Every preview is derived from an immutable baseline. Scaling changes object size and center distance from the shared pivot; rotation changes each center and its serialized rotation. A release commits the complete before/after set as one history action. Tracking loss, pause, mode change, or camera loss discards the preview.

## Gesture contract

- The configured dominant anatomical hand owns Scale, Rotate, and Cut.
- Scale and Rotate require an explicit contextual mode, a native-object selection, constrained thumb/index geometry, and middle/ring/pinky extension in a usable mid-range for the configured hold.
- Scale uses the change in mean middle/ring/pinky extension from the acquired baseline. Rotate uses the unwrapped image-plane angle from the wrist to the middle/ring palm axis.
- Gain, temporal hold, smoothing, scale dead zone, and rotation dead zone are local settings. Scale is limited to 25–400% of the acquired baseline.
- Cut requires explicit Cut mode, a hand-edge pose, palm-normalized travel of at least 0.5, normalized velocity of at least 0.0016 per millisecond, and release before rearming. Inactivity ends the sequence after 1.3 seconds. Counts are capped at 12.
- `N` completed chops request exactly `N` pieces. One chop therefore leaves the source unchanged.

Pending confirmation, calibration, two-hand acquisition, pause, and an active tablet/stylus stroke block new spatial gestures. Once acquired, a spatial transform owns the dominant hand until release or cancellation. Left-hand reactions remain suspended during that operation.

## Subdivision policies

| Source | Supported construction |
| --- | --- |
| Line | `N` equal-length collinear segments, including rotated lines. |
| Arrow | Same segments; only the final segment retains the arrowhead. |
| Triangle | `N` equal-area triangles from equal divisions of one edge to the opposite vertex. These pieces are not claimed to be similar. |
| Triangle, Similar mode | Four medial triangles from side midpoints. Other requested counts are rejected. |
| Rectangle or square | `N` equal-area strips along the longer local axis, preserving source rotation. |
| Convex polygon | `N` parallel slabs. Binary-searched half-plane cuts give every clipped convex region one `N`th of the source area within floating-point tolerance. |

Concave, self-intersecting, degenerate, or numerically unstable polygons are rejected. Circles and ellipses remain unsupported until the native model has sector or path objects. Text, freehand strokes, and connectors are not subdivided. A source referenced by an attached connector is blocked from subdivision so the relationship cannot be silently destroyed.

## History and synchronization

`transform-objects` contains validated before/after object arrays and a transform mode. `subdivide-object` contains the exact source baseline, fixed output IDs/geometries, method, and piece count. Their history actions replay deterministic geometry, so Undo restores the exact source state and Redo restores the same output IDs. BoardChannel request IDs retain the existing duplicate and leader-failover protection. Live previews are local visual state and never enter board history.
