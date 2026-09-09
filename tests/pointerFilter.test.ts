import { describe, it, expect } from 'vitest';
import { PointerFilter } from '../src/tracking/pointerFilter';
import { ExponentialSmoothingFilter, OneEuroFilter2D } from '../src/utils/math';

describe('PointerFilter & Math Filters', () => {
  it('ExponentialSmoothingFilter smooths high-frequency coordinate jumps', () => {
    const filter = new ExponentialSmoothingFilter(0.5);

    const p1 = filter.filter({ x: 0, y: 0 });
    expect(p1.x).toBe(0);
    expect(p1.y).toBe(0);

    // Sudden jump to (100, 100)
    const p2 = filter.filter({ x: 100, y: 100 });
    // 0.5 * 100 + 0.5 * 0 = 50
    expect(p2.x).toBe(50);
    expect(p2.y).toBe(50);

    // Next point at (100, 100)
    const p3 = filter.filter({ x: 100, y: 100 });
    // 0.5 * 100 + 0.5 * 50 = 75
    expect(p3.x).toBe(75);
    expect(p3.y).toBe(75);
  });

  it('OneEuroFilter2D eliminates jitter while allowing fast movement', () => {
    const filter = new OneEuroFilter2D(1.2, 0.015, 1.0);

    let t = 1000;
    const p1 = filter.filter({ x: 50, y: 50 }, t);
    expect(p1.x).toBeCloseTo(50);

    // Small jitter step
    t += 33;
    const p2 = filter.filter({ x: 50.4, y: 49.7 }, t);
    // Suppresses micro-jitter
    expect(Math.abs(p2.x - 50)).toBeLessThan(0.4);

    // Large fast movement (e.g. rapid hand gesture across screen)
    t += 33;
    const p3 = filter.filter({ x: 200, y: 300 }, t);
    // Adapts cutoff speed to follow fast movement
    expect(p3.x).toBeGreaterThan(100);
  });

  it('PointerFilter resets internal state properly when hand re-enters frame', () => {
    const pointerFilter = new PointerFilter({ useOneEuro: true });

    pointerFilter.filter({ x: 10, y: 10 }, 1000);
    pointerFilter.filter({ x: 20, y: 20 }, 1033);

    pointerFilter.reset();
    expect(pointerFilter.getLastSmoothed()).toBeNull();

    // After reset, first point should initialize directly
    const p = pointerFilter.filter({ x: 150, y: 250 }, 2000);
    expect(p.x).toBeCloseTo(150, 0);
    expect(p.y).toBeCloseTo(250, 0);
  });
});
