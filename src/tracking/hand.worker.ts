import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { checkedTimestamp, emptyWorkerStats, MODEL_OPTIONS, type FrameMessage, type WorkerReply } from './protocol';
import { InferenceSurface } from './surface';
export type { TrackingResult } from './protocol';
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: WorkerReply, transfer?: Transferable[]) => void;
};
let landmarker: HandLandmarker | null = null;
let surface: InferenceSurface | null = null;
let lastTimestamp = -1, threshold = 0.65, lastPreview = -Infinity;
const stats = emptyWorkerStats();
// Serialize async initialization/configuration and inference, including malformed test messages.
let queue = Promise.resolve();
scope.onmessage = event => {
  const message = event.data;
  queue = queue.then(async () => {
    if (message.kind === 'init') {
      try {
        landmarker?.close();
        const files = await FilesetResolver.forVisionTasks(message.base + '/vendor/mediapipe');
        landmarker = await HandLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: message.base + '/models/hand_landmarker.task', delegate: MODEL_OPTIONS.delegate },
          runningMode: MODEL_OPTIONS.runningMode, numHands: MODEL_OPTIONS.numHands,
          minHandDetectionConfidence: MODEL_OPTIONS.minHandDetectionConfidence,
          minHandPresenceConfidence: MODEL_OPTIONS.minHandPresenceConfidence,
          minTrackingConfidence: MODEL_OPTIONS.minTrackingConfidence,
        });
        surface = new InferenceSurface(); lastTimestamp = -1; threshold = 0.65;
        Object.assign(stats, emptyWorkerStats());
        scope.postMessage({ kind: 'ready', options: MODEL_OPTIONS });
      } catch (error) {
        stats.lastError = String(error);
        scope.postMessage({ kind: 'error', stage: 'init', error: stats.lastError, stats: { ...stats } });
      }
    } else if (message.kind === 'frame') await processFrame(message);
  }).catch(error => {
    stats.lastError = String(error);
    scope.postMessage({ kind: 'error', stage: 'frame', error: stats.lastError, stats: { ...stats } });
  });
};
async function processFrame(message: FrameMessage): Promise<void> {
  const bitmap = message.bitmap;
  stats.framesReceived++; stats.frameId = message.frameId ?? stats.framesReceived;
  stats.inputWidth = bitmap?.width ?? 0; stats.inputHeight = bitmap?.height ?? 0;
  scope.postMessage({ kind: 'received', frameId: stats.frameId, stats: { ...stats } });
  stats.landmarksArrayCount = 0; stats.detectedHandCount = 0; stats.landmarkCounts = []; stats.handedness = []; stats.duration = 0;
  let started: number | null = null;
  try {
    if (!landmarker || !surface) throw new Error('Frame received before model readiness');
    const timestamp = checkedTimestamp(message.timestamp, lastTimestamp);
    const input = surface.prepare(bitmap);
    const requestedThreshold = [0.35, 0.5, 0.65].includes(message.threshold ?? 0.65) ? (message.threshold ?? 0.65) : 0.65;
    if (threshold !== requestedThreshold) {
      await landmarker.setOptions({ minHandDetectionConfidence: requestedThreshold, minHandPresenceConfidence: requestedThreshold, minTrackingConfidence: requestedThreshold });
      threshold = requestedThreshold;
    }
    stats.threshold = threshold;
    const now = performance.now();
    if (message.preview && now - lastPreview >= 650) {
      lastPreview = now;
      try {
        const snapshot = surface.snapshot();
        scope.postMessage({ kind: 'preview', frameId: stats.frameId, ...snapshot,
          capturedAt: Date.now(), width: input.width, height: input.height, pipeline: message.pipeline ?? 'canvas',
        }, [snapshot.bitmap]);
      } catch (error) { scope.postMessage({ kind: 'error', stage: 'preview', error: String(error), frameId: stats.frameId, stats: { ...stats } }); }
    }
    started = performance.now(); stats.inferenceCalls++; lastTimestamp = timestamp;
    // Canvas normalizes video/bitmap backing and WebGL upload semantics; bitmap retained for diagnostic A/B.
    const result = landmarker.detectForVideo(message.pipeline === 'bitmap' ? bitmap : input, timestamp);
    stats.duration = performance.now() - started; stats.successfulInferences++; stats.lastSuccessAt = Date.now();
    stats.landmarksArrayCount = result.landmarks.length;
    stats.detectedHandCount = result.landmarks.filter(points => points.length === 21).length;
    stats.landmarkCounts = result.landmarks.map(points => points.length);
    stats.handedness = result.handedness.map(categories => categories.map(({ categoryName, score }) => ({ categoryName, score })));
    scope.postMessage({ kind: 'result', frameId: stats.frameId, status: result.landmarks.length ? 'hands' : 'zero-hands',
      landmarks: result.landmarks[0] ?? [], allLandmarks: result.landmarks, duration: stats.duration, timestamp, stats: { ...stats },
    });
  } catch (error) {
    stats.failedFrames++; stats.lastError = error instanceof Error ? error.message : String(error);
    if (started !== null) stats.duration = performance.now() - started;
    scope.postMessage({ kind: 'error', stage: 'frame', error: stats.lastError, frameId: stats.frameId, stats: { ...stats } });
  } finally { bitmap?.close(); }
}
