/**
 * SAAI AirBoard - Pointer Smoothing & Stabilisation Filter
 *
 * Implements Exponential Moving Average (EMA) and 1€ Filter
 * to suppress hand tremor without introducing perceptible drag or handwriting lag.
 */

import { Point2D } from '../types';
import { ExponentialSmoothingFilter, OneEuroFilter2D } from '../utils/math';

export interface PointerFilterOptions {
  useOneEuro: boolean;
  emaAlpha: number; // 0.1 to 1.0 (0.45 recommended for snappy handwriting)
  oneEuroMinCutoff: number; // Hz, default 1.2
  oneEuroBeta: number; // Speed coefficient, default 0.015
  oneEuroDCutoff: number; // Derivative cutoff, default 1.0
}

export class PointerFilter {
  private useOneEuro: boolean;
  private emaFilter: ExponentialSmoothingFilter;
  private oneEuroFilter: OneEuroFilter2D;
  private lastSmoothed: Point2D | null = null;

  constructor(options?: Partial<PointerFilterOptions>) {
    this.useOneEuro = options?.useOneEuro ?? true;
    this.emaFilter = new ExponentialSmoothingFilter(options?.emaAlpha ?? 0.45);
    this.oneEuroFilter = new OneEuroFilter2D(
      options?.oneEuroMinCutoff ?? 1.2,
      options?.oneEuroBeta ?? 0.015,
      options?.oneEuroDCutoff ?? 1.0
    );
  }

  updateOptions(options: Partial<PointerFilterOptions>): void {
    if (options.useOneEuro !== undefined) {
      this.useOneEuro = options.useOneEuro;
    }
    if (options.emaAlpha !== undefined) {
      this.emaFilter.setAlpha(options.emaAlpha);
    }
    if (
      options.oneEuroMinCutoff !== undefined ||
      options.oneEuroBeta !== undefined ||
      options.oneEuroDCutoff !== undefined
    ) {
      this.oneEuroFilter = new OneEuroFilter2D(
        options.oneEuroMinCutoff ?? 1.2,
        options.oneEuroBeta ?? 0.015,
        options.oneEuroDCutoff ?? 1.0
      );
    }
  }

  filter(rawPoint: Point2D, timestamp = performance.now()): Point2D {
    let smoothed: Point2D;
    if (this.useOneEuro) {
      smoothed = this.oneEuroFilter.filter(rawPoint, timestamp);
    } else {
      smoothed = this.emaFilter.filter(rawPoint);
    }
    this.lastSmoothed = smoothed;
    return smoothed;
  }

  reset(): void {
    this.emaFilter.reset();
    this.oneEuroFilter.reset();
    this.lastSmoothed = null;
  }

  getLastSmoothed(): Point2D | null {
    return this.lastSmoothed ? { ...this.lastSmoothed } : null;
  }
}
