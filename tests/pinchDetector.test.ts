import { describe, it, expect } from 'vitest';
import { PinchDetector } from '../src/tracking/pinchDetector';
import { NormalizedLandmark } from '../src/types';

function createMockLandmarks(thumbX: number, thumbY: number, indexX: number, indexY: number, palmScale = 0.2): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  // Landmark 0: Wrist
  landmarks[0] = { x: 0.5, y: 0.7, z: 0 };
  // Landmark 9: Middle MCP (wrist-to-MCP distance = palmScale)
  landmarks[9] = { x: 0.5, y: 0.7 - palmScale, z: 0 };
  // Landmark 4: Thumb Tip
  landmarks[4] = { x: thumbX, y: thumbY, z: 0 };
  // Landmark 8: Index Tip
  landmarks[8] = { x: indexX, y: indexY, z: 0 };
  return landmarks;
}

describe('PinchDetector', () => {
  it('normalizes pinch distance by palm scale rather than raw Euclidean distance alone', () => {
    const detector = new PinchDetector({ pinchThreshold: 0.35, releaseThreshold: 0.5 });

    // Palm scale = 0.20
    // Thumb and index distance = 0.04 -> normalized = 0.04 / 0.20 = 0.20
    const landmarks = createMockLandmarks(0.5, 0.4, 0.5, 0.44, 0.2);
    const result = detector.processLandmarks(landmarks, 0.9);

    expect(result.distance).toBeCloseTo(0.04);
    expect(result.normalizedDistance).toBeCloseTo(0.20);
    expect(result.isPinching).toBe(true);
    expect(result.phase).toBe('start');
  });

  it('implements hysteresis: does not release immediately above pinchThreshold until releaseThreshold is reached', () => {
    const detector = new PinchDetector({ pinchThreshold: 0.35, releaseThreshold: 0.50 });

    // Step 1: Trigger pinch (dist = 0.04 / 0.2 = 0.20 <= 0.35)
    let landmarks = createMockLandmarks(0.5, 0.4, 0.5, 0.44, 0.2);
    let state = detector.processLandmarks(landmarks);
    expect(state.isPinching).toBe(true);
    expect(state.phase).toBe('start');

    // Step 2: Distance increases to 0.42 (above pinch 0.35, but below release 0.50)
    landmarks = createMockLandmarks(0.5, 0.4, 0.5, 0.484, 0.2); // 0.084 / 0.2 = 0.42
    state = detector.processLandmarks(landmarks);
    // Should maintain pinchHold due to hysteresis!
    expect(state.isPinching).toBe(true);
    expect(state.phase).toBe('hold');

    // Step 3: Distance increases beyond release threshold (0.12 / 0.2 = 0.60 > 0.50)
    landmarks = createMockLandmarks(0.5, 0.4, 0.5, 0.52, 0.2);
    state = detector.processLandmarks(landmarks);
    expect(state.isPinching).toBe(false);
    expect(state.phase).toBe('end');

    // Step 4: Next frame is idle
    state = detector.processLandmarks(landmarks);
    expect(state.isPinching).toBe(false);
    expect(state.phase).toBe('idle');
  });

  it('immediately ends pinch and resets if hand landmarks are lost', () => {
    const detector = new PinchDetector();
    const landmarks = createMockLandmarks(0.5, 0.4, 0.5, 0.42, 0.2);
    let state = detector.processLandmarks(landmarks);
    expect(state.isPinching).toBe(true);

    // Sudden loss of hand tracking
    state = detector.processLandmarks(null);
    expect(state.isPinching).toBe(false);
    expect(state.phase).toBe('end');

    // Next frame when still null
    state = detector.processLandmarks([]);
    expect(state.isPinching).toBe(false);
    expect(state.phase).toBe('idle');
  });
});
