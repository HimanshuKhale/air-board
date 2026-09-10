import type { Point, Size } from '../core/types';
export type PinchPhase = 'hover' | 'pinchStart' | 'pinchHold' | 'pinchEnd';
/** Pixel-aspect-correct 2D tip distance / mean palm length and width. */
export function normalizedPinch(points: Point[], camera: Size): number {
  if (points.length !== 21 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return Infinity;
  const distance = (a: number, b: number) => Math.hypot((points[a].x - points[b].x) * camera.width, (points[a].y - points[b].y) * camera.height);
  const palm = (distance(0, 9) + distance(5, 17)) / 2;
  return palm > 1 ? distance(4, 8) / palm : Infinity;
}
export class PinchDetector {
  private held = false;
  private candidate: number | null = null;
  private armed = false;
  constructor(public close = 0.28, public open = 0.42, public debounceMs = 65) {}
  update(ratio: number, time: number): PinchPhase {
    if (!Number.isFinite(ratio)) return this.reset();
    // After acquisition/loss, demand an open hand before allowing another press.
    if (!this.armed) { if (ratio >= this.open) this.armed = true; return 'hover'; }
    if (this.held) {
      if (ratio >= this.open) { this.held = false; this.candidate = null; return 'pinchEnd'; }
      return 'pinchHold';
    }
    if (ratio <= this.close) {
      this.candidate ??= time;
      if (time - this.candidate >= this.debounceMs) { this.held = true; this.candidate = null; return 'pinchStart'; }
    } else this.candidate = null;
    return 'hover';
  }
  reset(): PinchPhase {
    const phase = this.held ? 'pinchEnd' : 'hover';
    this.held = false; this.armed = false; this.candidate = null;
    return phase;
  }
}
