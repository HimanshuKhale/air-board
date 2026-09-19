# Camera pipeline diagnostics

Debug Mode instruments `MediaStream -> HTMLVideoElement -> normalized canvas capture -> ImageBitmap transfer -> worker OffscreenCanvas -> MediaPipe HandLandmarker -> result message`.

The default inference path draws each decoded video frame into an opaque, correctly sized main-thread canvas, creates one transferable ImageBitmap, draws that bitmap into a same-size worker OffscreenCanvas, and passes the canvas to `detectForVideo`. The worker owns and closes each transferred bitmap. Only one frame is in flight. Frame IDs and timestamps must increase strictly.

Neither capture step mirrors the inference pixels. Camera preview mirroring is applied later through CSS and `cameraToCanvas`, so it must not change physical hand roles. For this pipeline, MediaPipe's raw Left/Right label is used directly as the physical label; conversion swaps only if a future inference source is explicitly mirrored. Debug Mode reports raw label, physical label, handedness score, each hand's current gesture, and the selected writing and confirmation roles. **Verify physical Right** and **Verify physical Left** require exactly one confidently identified hand and report the observed physical label.

The optional **Worker Input Preview** returns a worker-side snapshot at about 1.5 FPS. It reports dimensions, RGB range/mean, alpha mean, a sampled fingerprint and frame age. The direct ImageBitmap path remains a debug-only comparator. Disabling Debug restores the normalized path and original 0.65 detection/presence/tracking thresholds.

Automated evidence proves that portrait, nonuniform, fully opaque frames reach the worker in the expected orientation; invalid frames report failure separately from successful zero-hand inference; the local known-hand fixture produces two hands with 21 landmarks through both paths; and synthetic labels stay stable when preview mirror changes. It does not prove that a particular webcam/driver preserves the expected orientation or that MediaPipe recognizes a live hand reliably. Use both physical-hand verification buttons and the checklist on the target device.
