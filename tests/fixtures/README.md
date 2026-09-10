# Known-hand test fixture

right_hands.jpg is Google's MediaPipe test image, downloaded once for local automated testing:
https://storage.googleapis.com/mediapipe-assets/right_hands.jpg?generation=1661875908672404

SHA-256: 240c082e80128ff1ca8a83ce645e2ba4d8bc30f0967b7991cf5fa375bab489e1

Upstream provenance: MediaPipe third_party/external_files.bzl (com_google_mediapipe_right_hands_jpg), historical releases such as v0.10.21:
https://github.com/google-ai-edge/mediapipe/blob/v0.10.21/third_party/external_files.bzl

The test image is not included in public/ or dist/ and is never downloaded during app runtime or the test run. Tests embed the local bytes into the isolated test page.

Positive recognition of this photograph verifies more than blank-frame execution, but does NOT establish recognition from the user's Galaxy virtual webcam, its driver, lighting, orientation or live frame backing.
