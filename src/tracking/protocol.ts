import type { Point } from '../core/types';
export const MODEL_OPTIONS = {
  runningMode: 'VIDEO' as const, numHands: 1, delegate: 'CPU' as const,
  minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65,
};
export type Pipeline = 'canvas' | 'bitmap';
export interface DebugOptions { enabled: boolean; preview: boolean; threshold: 0.65 | 0.5 | 0.35; pipeline: Pipeline }
export const defaultDebug = (): DebugOptions => ({ enabled: false, preview: false, threshold: 0.65, pipeline: 'canvas' });
export interface WorkerStats {
  framesReceived: number; inferenceCalls: number; successfulInferences: number; failedFrames: number;
  frameId: number; inputWidth: number; inputHeight: number; duration: number;
  landmarksArrayCount: number; detectedHandCount: number; landmarkCounts: number[];
  handedness: { categoryName: string; score: number }[][];
  lastSuccessAt: number | null; lastError: string | null; threshold: number;
}
export const emptyWorkerStats = (): WorkerStats => ({
  framesReceived: 0, inferenceCalls: 0, successfulInferences: 0, failedFrames: 0,
  frameId: 0, inputWidth: 0, inputHeight: 0, duration: 0, landmarksArrayCount: 0,
  detectedHandCount: 0, landmarkCounts: [], handedness: [], lastSuccessAt: null, lastError: null, threshold: 0.65,
});
export interface PixelSummary { min: number; max: number; mean: number; meanAlpha: number; fingerprint: number }
export interface TrackingResult {
  kind: 'result'; frameId: number; status: 'hands' | 'zero-hands';
  landmarks: Point[]; allLandmarks: Point[][]; duration: number; timestamp: number; stats: WorkerStats;
}
export interface PreviewMessage {
  kind: 'preview'; frameId: number; bitmap: ImageBitmap; capturedAt: number;
  width: number; height: number; pixels: PixelSummary; pipeline: Pipeline;
}
export type WorkerReply =
  | { kind: 'ready'; options: typeof MODEL_OPTIONS }
  | { kind: 'received'; frameId: number; stats: WorkerStats }
  | TrackingResult | PreviewMessage
  | { kind: 'error'; stage: 'init' | 'frame' | 'preview'; error: string; frameId?: number; stats: WorkerStats };
export interface FrameMessage {
  kind: 'frame'; frameId?: number; bitmap: ImageBitmap; timestamp: number;
  preview?: boolean; threshold?: number; pipeline?: Pipeline;
}
export function captureDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Video frame has zero or invalid dimensions');
  const scale = Math.min(1, 640 / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function checkedTimestamp(timestamp: number, previous: number): number {
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp <= previous) throw new Error('Frame timestamp is not strictly increasing');
  return timestamp;
}
export function pixelSummary(data: Uint8ClampedArray): PixelSummary {
  let min = 255, max = 0, total = 0, alpha = 0, fingerprint = 2166136261;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    min = Math.min(min, luma); max = Math.max(max, luma); total += luma; alpha += data[i + 3];
    for (let c = 0; c < 4; c++) fingerprint = Math.imul(fingerprint ^ data[i + c], 16777619) >>> 0;
  }
  const count = data.length / 4;
  return { min, max, mean: count ? total / count : 0, meanAlpha: count ? alpha / count : 0, fingerprint };
}
