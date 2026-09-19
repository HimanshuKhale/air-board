import type { Point, Settings, Size } from '../core/types';
import type { HandPointer } from '../input/gesture';
import { ExponentialFilter } from '../input/filter';
import { classifyPenGrip } from './pose';
import { virtualNib } from './stylus';

/** Converts a stable three-point writing grip into explicit down/up phases for the estimated virtual nib. */
export class PenWritingController {
  private filter = new ExponentialFilter();
  private candidateAt: number | null = null;
  private held = false;
  private released = false;
  get down(): boolean { return this.held; }
  update(points: Point[], size: Size, now: number, settings: Settings): HandPointer | null {
    const nib = virtualNib(points, size); if (!nib) { this.reset(); return null; }
    const grip = classifyPenGrip(points, size);
    this.filter.alpha = settings.smoothing;
    const smooth = this.filter.update(nib, now);
    let phase: HandPointer['phase'] = 'hover';
    if (!grip.active) {
      this.candidateAt = null; this.released = true;
      if (this.held) { this.held = false; phase = 'pinchEnd'; }
    } else if (this.held) phase = 'pinchHold';
    else if (this.released) {
      this.candidateAt ??= now;
      if (now - this.candidateAt >= settings.penGripHoldMs) { this.held = true; this.candidateAt = null; phase = 'pinchStart'; }
    }
    return { raw: nib, smooth, phase, ratio: grip.confidence, landmarks: points };
  }
  reset(): void { this.filter.reset(); this.candidateAt = null; this.held = false; this.released = false; }
}
