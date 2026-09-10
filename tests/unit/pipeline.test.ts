import { describe, expect, it } from 'vitest';
import { captureDimensions, checkedTimestamp, defaultDebug, MODEL_OPTIONS, pixelSummary } from '../../src/tracking/protocol';
describe('frame transport helpers', () => {
  it('preserves full landscape and portrait aspect without cropping or upscaling', () => {
    expect(captureDimensions(1280, 720)).toEqual({ width: 640, height: 360 });
    expect(captureDimensions(720, 1280)).toEqual({ width: 640, height: 1138 });
    expect(captureDimensions(360, 640)).toEqual({ width: 360, height: 640 });
  });
  it.each([[0, 720], [1280, 0], [-1, 10], [NaN, 1], [1, Infinity]])('rejects invalid dimensions %s × %s', (w, h) => {
    expect(() => captureDimensions(w, h)).toThrow();
  });
  it('rejects stale/duplicate/nonfinite inference timestamps', () => {
    expect(checkedTimestamp(50, 40)).toBe(50);
    for (const stamp of [40, 30, -1, NaN, Infinity]) expect(() => checkedTimestamp(stamp, 40)).toThrow();
  });
  it('makes alpha, blank colors and changing pixels distinguishable', () => {
    const transparent = pixelSummary(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0]));
    const solid = pixelSummary(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]));
    const varied = pixelSummary(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]));
    expect(transparent.meanAlpha).toBe(0); expect(solid.meanAlpha).toBe(255);
    expect(solid.max - solid.min).toBe(0); expect(varied.max - varied.min).toBeGreaterThan(0);
    expect(solid.fingerprint).not.toBe(varied.fingerprint);
  });
  it('leaves production thresholds unchanged and debug off', () => {
    expect(MODEL_OPTIONS).toMatchObject({ runningMode: 'VIDEO', numHands: 1, delegate: 'CPU', minHandDetectionConfidence: 0.65, minHandPresenceConfidence: 0.65, minTrackingConfidence: 0.65 });
    expect(defaultDebug()).toEqual({ enabled: false, preview: false, threshold: 0.65, pipeline: 'canvas' });
  });
});
