# Camera pipeline diagnostics

Debug Mode instruments `MediaStream -> HTMLVideoElement -> normalized canvas capture -> ImageBitmap transfer -> worker OffscreenCanvas -> MediaPipe HandLandmarker -> result message`.

The default inference path draws each decoded video frame into an opaque, correctly sized main-thread canvas, creates one transferable ImageBitmap, draws that bitmap into a same-size worker OffscreenCanvas, and passes the canvas to `detectForVideo`. The worker owns and closes each transferred bitmap. Only one frame is in flight. Frame IDs and timestamps must increase strictly.

The optional **Worker Input Preview** returns a worker-side snapshot at about 1.5 FPS. It reports dimensions, RGB range/mean, alpha mean, a sampled fingerprint and frame age. The direct ImageBitmap path remains a debug-only comparator. Disabling Debug restores the normalized path and original 0.65 detection/presence/tracking thresholds.

Automated evidence proves that portrait, nonuniform, fully opaque frames reach the worker in the expected orientation; invalid frames report failure separately from successful zero-hand inference; and the local known-hand fixture produces two hands with 21 landmarks through both paths. It does not prove that frames from a real Windows Virtual Camera are valid or that MediaPipe recognizes a live hand. Use the checklist to compare the visible camera preview with the exact worker snapshot on that device.
