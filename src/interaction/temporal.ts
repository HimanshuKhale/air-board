import type { StaticGesture } from './pose';

export interface StablePose { instantaneous: StaticGesture; stable: StaticGesture; confidence: number; enterElapsedMs: number }

export class PoseStabilizer {
  private candidate: StaticGesture = 'neutral';
  private candidateAt = 0;
  private stable: StaticGesture = 'neutral';
  update(gesture: StaticGesture, confidence: number, now: number, holdMs: (gesture: StaticGesture) => number): StablePose {
    if (gesture !== this.candidate) { this.candidate = gesture; this.candidateAt = now; }
    const elapsed = Math.max(0, now - this.candidateAt);
    if (gesture === 'neutral' || gesture === 'pinch') this.stable = gesture;
    else if (elapsed >= holdMs(gesture)) this.stable = gesture;
    else if (this.stable !== gesture) this.stable = 'neutral';
    return { instantaneous: gesture, stable: this.stable, confidence, enterElapsedMs: elapsed };
  }
  reset(): void { this.candidate = 'neutral'; this.candidateAt = 0; this.stable = 'neutral'; }
}
