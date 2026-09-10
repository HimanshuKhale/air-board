import type { Point, Settings, Size } from '../core/types';
import { ExponentialFilter } from './filter';
import { normalizedPinch, PinchDetector, type PinchPhase } from './pinch';
export interface HandPointer { raw: Point; smooth: Point; phase: PinchPhase; ratio: number; landmarks: Point[] }
/** Adapter boundary: tracker-specific result objects never reach the drawing engine. */
export class GestureController {
  readonly filter = new ExponentialFilter();
  readonly pinch = new PinchDetector();
  private previous: Point | null = null;
  update(landmarks: Point[], size: Size, time: number, settings: Settings): HandPointer | null {
    if (landmarks.length !== 21 || settings.paused) { this.reset(); return null; }
    const raw = landmarks[8];
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) { this.reset(); return null; }
    // Discontinuity (e.g. tracker switched hands) disarms instead of bridging a stroke.
    if (this.previous && Math.hypot(raw.x - this.previous.x, raw.y - this.previous.y) > 0.3) { this.reset(); return null; }
    this.previous = raw;
    this.filter.alpha = settings.smoothing;
    this.pinch.close = settings.pinchClose; this.pinch.open = settings.pinchOpen; this.pinch.debounceMs = settings.debounceMs;
    const ratio = normalizedPinch(landmarks, size);
    return { raw, smooth: this.filter.update(raw, time), ratio, phase: this.pinch.update(ratio, time), landmarks };
  }
  reset(): void { this.filter.reset(); this.pinch.reset(); this.previous = null; }
}
