import type { Point, Size } from '../core/types';
import { palmCenter } from './pose';

export interface TwoHandState { close: boolean; heldMs: number; armed: boolean }

/** Debounced, release-to-rearm global toggle based on aspect-correct palm-center proximity. */
export class TwoHandToggle {
  readonly state: TwoHandState = { close: false, heldMs: 0, armed: true };
  private candidateAt: number | null = null;
  private lastToggleAt = -Infinity;
  update(hands: Point[][], size: Size, now: number, holdMs: number, proximity: number, cooldownMs = 1300): boolean {
    const valid = hands.filter(hand => hand.length === 21);
    const close = valid.length >= 2 && (() => {
      const a = palmCenter(valid[0]), b = palmCenter(valid[1]);
      return Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height) / Math.max(1, Math.min(size.width, size.height)) <= proximity;
    })();
    this.state.close = close;
    if (!close) {
      this.candidateAt = null; this.state.heldMs = 0; this.state.armed = true; return false;
    }
    this.candidateAt ??= now;
    this.state.heldMs = Math.max(0, now - this.candidateAt);
    if (!this.state.armed || this.state.heldMs < holdMs || now - this.lastToggleAt < cooldownMs) return false;
    this.state.armed = false; this.lastToggleAt = now; return true;
  }
  reset(): void { this.candidateAt = null; this.lastToggleAt = -Infinity; Object.assign(this.state, { close: false, heldMs: 0, armed: true }); }
}
