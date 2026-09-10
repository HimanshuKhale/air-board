import type { Point } from '../core/types';
export interface PointerFilter { update(point: Point, time: number): Point; reset(): void }
/** Time-adjusted EMA: alpha is response at 30 Hz, independent of inference rate. */
export class ExponentialFilter implements PointerFilter {
  private value: Point | null = null;
  private time = 0;
  constructor(public alpha = 0.6) {}
  update(point: Point, time: number): Point {
    if (!this.value || time - this.time > 250) this.value = { ...point };
    else {
      const weight = 1 - (1 - Math.min(1, Math.max(0.05, this.alpha))) ** (Math.max(1, time - this.time) / (1000 / 30));
      this.value = { x: this.value.x + weight * (point.x - this.value.x), y: this.value.y + weight * (point.y - this.value.y) };
    }
    this.time = time;
    return { ...this.value };
  }
  reset(): void { this.value = null; }
}
