/**
 * SAAI AirBoard - Math & Signal Filtering Utilities
 */

import { Point2D } from '../types';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function distance2D(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPoint(p1: Point2D, p2: Point2D, t: number): Point2D {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
}

/**
 * Exponential Moving Average Filter for 2D coordinates.
 * Higher alpha = more responsive / less lag.
 * Lower alpha = smoother / more lag.
 */
export class ExponentialSmoothingFilter {
  private current: Point2D | null = null;
  private alpha: number;

  constructor(alpha = 0.45) {
    this.alpha = clamp(alpha, 0.01, 1.0);
  }

  setAlpha(alpha: number): void {
    this.alpha = clamp(alpha, 0.01, 1.0);
  }

  filter(point: Point2D): Point2D {
    if (!this.current) {
      this.current = { ...point };
      return { ...this.current };
    }
    this.current = {
      x: this.alpha * point.x + (1 - this.alpha) * this.current.x,
      y: this.alpha * point.y + (1 - this.alpha) * this.current.y,
    };
    return { ...this.current };
  }

  reset(): void {
    this.current = null;
  }

  getCurrent(): Point2D | null {
    return this.current ? { ...this.current } : null;
  }
}

/**
 * Low-pass filter for One Euro Filter implementation.
 */
class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  setAlpha(alpha: number): void {
    this.alpha = clamp(alpha, 0, 1);
  }

  private alpha = 0.5;

  filter(value: number, alpha: number): number {
    this.setAlpha(alpha);
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.s = this.alpha * value + (1.0 - this.alpha) * this.s!;
    this.y = this.s;
    return this.y;
  }

  hasLastRawValue(): boolean {
    return this.y !== null;
  }

  lastRawValue(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

/**
 * 1€ Filter (Casiez et al., CHI 2012)
 * Precise, adaptive jitter-reduction filter:
 * Smooths high-frequency jitter at low speeds while eliminating lag at high speeds.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilt: LowPassFilter;
  private dxFilt: LowPassFilter;
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilt = new LowPassFilter();
    this.dxFilt = new LowPassFilter();
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(val: number, timestamp = performance.now()): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilt.filter(val, 1.0);
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000.0, 1e-5);
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    const dx = this.xFilt.hasLastRawValue()
      ? (val - this.xFilt.lastRawValue()) * rate
      : 0.0;

    const edx = this.dxFilt.filter(dx, this.alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilt.filter(val, this.alpha(rate, cutoff));
  }

  reset(): void {
    this.xFilt.reset();
    this.dxFilt.reset();
    this.lastTime = null;
  }
}

/**
 * 2D One Euro Filter combining X and Y channels.
 */
export class OneEuroFilter2D {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(minCutoff = 1.2, beta = 0.015, dCutoff = 1.0) {
    this.filterX = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.filterY = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  filter(point: Point2D, timestamp = performance.now()): Point2D {
    return {
      x: this.filterX.filter(point.x, timestamp),
      y: this.filterY.filter(point.y, timestamp),
      time: timestamp,
    };
  }

  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
