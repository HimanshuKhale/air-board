import { describe, expect, it } from 'vitest';
import { cameraToCanvas, canvasToClient, clientToCanvas, fitRect } from '../../src/core/coordinates';
import { defaults, initialState } from '../../src/core/settings';
import { ExponentialFilter } from '../../src/input/filter';
import { normalizedPinch, PinchDetector } from '../../src/input/pinch';
import { GestureController } from '../../src/input/gesture';
import { exportFilename } from '../../src/export/compositor';
import { reduce, validCommand, validState } from '../../src/sync/protocol';
import type { Point } from '../../src/core/types';

describe('coordinate spaces', () => {
  it('mirrors index point with contain letterboxing', () => {
    expect(cameraToCanvas({ x: 0.25, y: 0.5 }, { width: 640, height: 480 }, { width: 1600, height: 900 }, true, 'contain')).toEqual({ x: 1100, y: 450 });
    expect(cameraToCanvas({ x: 0.25, y: 0.5 }, { width: 640, height: 480 }, { width: 1600, height: 900 }, false, 'contain')).toEqual({ x: 500, y: 450 });
  });
  it('accounts for cover cropping and stretch', () => {
    expect(fitRect({ width: 640, height: 480 }, { width: 1600, height: 900 }, 'cover')).toEqual({ x: 0, y: -150, width: 1600, height: 1200 });
    expect(fitRect({ width: 640, height: 480 }, { width: 1600, height: 900 }, 'stretch')).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
  });
  it('round-trips arbitrary board offsets and CSS scaling', () => {
    const rect = { x: 120, y: 70, width: 800, height: 450 }, size = { width: 1600, height: 900 }, p = { x: 1234, y: 432 };
    expect(clientToCanvas(canvasToClient(p, rect, size), rect, size)).toEqual(p);
  });
  it('rejects zero source dimensions', () => expect(() => fitRect({ width: 0, height: 1 }, { width: 1, height: 1 }, 'contain')).toThrow());
});
function hand(scale = 1): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  p[0] = { x: 0.4, y: 0.7 }; p[9] = { x: 0.4, y: 0.3 };
  p[5] = { x: 0.25, y: 0.4 }; p[17] = { x: 0.55, y: 0.4 };
  p[8] = { x: 0.3, y: 0.2 }; p[4] = { x: 0.35, y: 0.2 };
  return p.map(({ x, y }) => ({ x: x * scale, y: y * scale }));
}
describe('pinch', () => {
  it('is scale invariant and aspect-correct', () => {
    const size = { width: 640, height: 480 };
    expect(normalizedPinch(hand(), size)).toBeCloseTo(1 / 6);
    expect(normalizedPinch(hand(0.5), size)).toBeCloseTo(normalizedPinch(hand(), size));
  });
  it('rejects missing and degenerate hands', () => {
    expect(normalizedPinch([], { width: 640, height: 480 })).toBe(Infinity);
    expect(normalizedPinch(Array(21).fill({ x: 0, y: 0 }), { width: 640, height: 480 })).toBe(Infinity);
  });
  it('requires open hand, debounces closing and releases immediately at open threshold', () => {
    const d = new PinchDetector();
    expect(d.update(0.1, 0)).toBe('hover');
    expect(d.update(0.5, 40)).toBe('hover');
    expect(d.update(0.2, 70)).toBe('hover');
    expect(d.update(0.2, 100)).toBe('hover');
    expect(d.update(0.2, 140)).toBe('pinchStart');
    expect(d.update(0.35, 175)).toBe('pinchHold');
    expect(d.update(0.42, 210)).toBe('pinchEnd');
    expect(d.update(0.5, 240)).toBe('hover');
  });
  it('resets debounce on noise and disarms after hand loss', () => {
    const d = new PinchDetector();
    d.update(0.6, 0); d.update(0.2, 40); d.update(0.3, 90);
    expect(d.update(0.2, 110)).toBe('hover');
    expect(d.update(0.2, 180)).toBe('pinchStart');
    expect(d.reset()).toBe('pinchEnd');
    expect(d.update(0.2, 400)).toBe('hover');
    expect(d.update(0.2, 600)).toBe('hover');
  });
});
describe('filter and loss handling', () => {
  it('initializes without lag, smooths with bounded response and resets without a bridge', () => {
    const f = new ExponentialFilter(0.5);
    expect(f.update({ x: 0, y: 0 }, 0)).toEqual({ x: 0, y: 0 });
    expect(f.update({ x: 1, y: 1 }, 1000 / 30).x).toBeCloseTo(0.5);
    f.reset(); expect(f.update({ x: 1, y: 1 }, 80)).toEqual({ x: 1, y: 1 });
  });
  it('produces matching response for equal elapsed time at different sample rates', () => {
    const a = new ExponentialFilter(0.6), b = new ExponentialFilter(0.6);
    a.update({ x: 0, y: 0 }, 0); b.update({ x: 0, y: 0 }, 0);
    a.update({ x: 1, y: 1 }, 1000 / 60);
    expect(a.update({ x: 1, y: 1 }, 1000 / 30).x).toBeCloseTo(b.update({ x: 1, y: 1 }, 1000 / 30).x);
  });
  it('drops a switched hand and paused input', () => {
    const g = new GestureController(), size = { width: 640, height: 480 };
    expect(g.update(hand(), size, 0, defaults())).not.toBeNull();
    const changed = hand(); changed[8] = { x: 0.9, y: 0.9 };
    expect(g.update(changed, size, 40, defaults())).toBeNull();
    expect(g.update(hand(), size, 80, { ...defaults(), paused: true })).toBeNull();
  });
});
describe('history and message validation', () => {
  const stroke = (state: ReturnType<typeof initialState>, id: string, tool: 'pen' | 'eraser' = 'pen') => {
    reduce(state, { type: 'begin', id, brush: { ...defaults().brush, tool }, point: { x: 10, y: 10 } });
    reduce(state, { type: 'point', id, point: { x: 100, y: 100 } });
    reduce(state, { type: 'end', id });
  };
  it('commits one action per stroke, including erasing, and supports undo/redo', () => {
    const state = initialState(); stroke(state, 'a'); stroke(state, 'b', 'eraser');
    expect(state.history.actions).toHaveLength(2);
    reduce(state, { type: 'undo' }); expect(state.history.position).toBe(1);
    reduce(state, { type: 'redo' }); expect(state.history.position).toBe(2);
    expect(validState(state)).toBe(true);
  });
  it('invalidates redo when drawing a new branch and makes clear undoable', () => {
    const state = initialState(); stroke(state, 'a'); stroke(state, 'b');
    reduce(state, { type: 'undo' }); stroke(state, 'c');
    expect(state.history.actions).toHaveLength(2);
    expect(state.history.actions[1]).toMatchObject({ stroke: { id: 'c' } });
    reduce(state, { type: 'clear' }); expect(state.history.actions.at(-1)).toEqual({ kind: 'clear' });
    reduce(state, { type: 'undo' }); expect(state.history.position).toBe(2);
  });
  it('ignores points and ends belonging to another input, snapshots brush settings', () => {
    const state = initialState(), brush = defaults().brush;
    reduce(state, { type: 'begin', id: 'a', brush, point: { x: 10, y: 20 } });
    brush.color = '#ff0000';
    reduce(state, { type: 'point', id: 'b', point: { x: 100, y: 200 } });
    reduce(state, { type: 'end', id: 'b' });
    expect(state.history.active?.points).toHaveLength(1);
    expect(state.history.active?.brush.color).toBe('#225c4a');
  });
  it('rejects malformed, non-finite, out-of-bounds and external asset commands', () => {
    expect(validCommand(null)).toBe(false);
    expect(validCommand({ type: 'point', id: 'a', point: { x: NaN, y: 2 } })).toBe(false);
    expect(validCommand({ type: 'point', id: 'a', point: { x: -1, y: 2 } })).toBe(false);
    expect(validCommand({ type: 'settings', patch: { __unknown: true } })).toBe(false);
    expect(validCommand({ type: 'settings', patch: { background: { ...defaults().background, image: 'https://example.org/image.png' } } })).toBe(false);
    expect(validCommand({ type: 'settings', patch: { pinchClose: 0.8 } })).toBe(false);
    expect(validState({ settings: {}, history: initialState().history })).toBe(false);
  });
  it('ends a live stroke before a synchronized tool change', () => {
    const state = initialState();
    reduce(state, { type: 'begin', id: 'a', brush: defaults().brush, point: { x: 10, y: 20 } });
    reduce(state, { type: 'settings', patch: { brush: { ...defaults().brush, tool: 'eraser' } } });
    expect(state.history.active).toBeNull();
    expect(state.history.position).toBe(1);
  });
});
it('names exports with local time and transparency suffix', () => {
  expect(exportFilename(new Date(2026, 8, 10, 9, 5, 3), true)).toBe('saai-airboard-2026-09-10-090503-drawing.png');
});
