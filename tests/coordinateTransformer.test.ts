import { describe, it, expect } from 'vitest';
import { CoordinateTransformer } from '../src/tracking/coordinateTransformer';

describe('CoordinateTransformer', () => {
  it('correctly mirrors normalized horizontal coordinates when mirror=true', () => {
    const transformer = new CoordinateTransformer({
      mirror: true,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    const norm = transformer.toNormalizedMirrored({ x: 0.2, y: 0.4 });
    expect(norm.x).toBeCloseTo(0.8);
    expect(norm.y).toBeCloseTo(0.4);
  });

  it('preserves horizontal coordinates when mirror=false', () => {
    const transformer = new CoordinateTransformer({
      mirror: false,
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    const norm = transformer.toNormalizedMirrored({ x: 0.2, y: 0.4 });
    expect(norm.x).toBeCloseTo(0.2);
    expect(norm.y).toBeCloseTo(0.4);
  });

  it('transforms normalized points to viewport pixels accurately', () => {
    const transformer = new CoordinateTransformer({
      mirror: true,
      viewportWidth: 1000,
      viewportHeight: 500,
    });

    // x=0.2 mirrored becomes 0.8 -> 0.8 * 1000 = 800px
    // y=0.5 -> 0.5 * 500 = 250px
    const pixels = transformer.toViewportPixels({ x: 0.2, y: 0.5 });
    expect(pixels.x).toBe(800);
    expect(pixels.y).toBe(250);
  });

  it('transforms normalized points to canvas dimensions when canvas dims differ from viewport', () => {
    const transformer = new CoordinateTransformer({
      mirror: false,
      viewportWidth: 1000,
      viewportHeight: 500,
      canvasWidth: 2000,
      canvasHeight: 1000,
    });

    const canvasPoint = transformer.toCanvasPixels({ x: 0.5, y: 0.5 });
    expect(canvasPoint.x).toBe(1000);
    expect(canvasPoint.y).toBe(500);
  });

  it('clamps coordinates outside 0..1 range', () => {
    const transformer = new CoordinateTransformer({
      mirror: false,
      viewportWidth: 1000,
      viewportHeight: 500,
    });

    const outOfBounds = transformer.toNormalizedMirrored({ x: 1.5, y: -0.2 });
    expect(outOfBounds.x).toBe(1.0);
    expect(outOfBounds.y).toBe(0.0);
  });
});
