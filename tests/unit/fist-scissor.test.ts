import { describe, expect, it } from 'vitest';
import type { BoardObject, CutLine, Point } from '../../src/core/types';
import { initialState } from '../../src/core/settings';
import { cutObject } from '../../src/drawing/cutting';
import { signedArea } from '../../src/drawing/geometry';
import { currentObjects } from '../../src/drawing/history';
import { objectOutline } from '../../src/drawing/objects';
import { manipulateSelection } from '../../src/drawing/spatial';
import { classifyFistManipulation, FistManipulationController, type FistPose } from '../../src/interaction/fist-manipulation';
import { ScissorController, classifyScissors, type ScissorPose } from '../../src/interaction/scissors';
import { InteractionController } from '../../src/interaction/controller';
import type { TrackingResult } from '../../src/tracking/protocol';
import { reduce, validCommand, validState } from '../../src/sync/protocol';

const rectangle = (id = 'rect'): BoardObject => ({ id, type: 'rectangle', x: 200, y: 200, width: 240, height: 120, color: '#225c4a', strokeWidth: 5, text: '', rotation: 0 });
const pose = (overrides: Partial<FistPose> = {}): FistPose => ({ active: true, confidence: .9, anchor: { x: .3, y: .3 }, apparentSize: .18, orientation: 3.1, reliableSize: true, reliableOrientation: true, ...overrides });
const options = { holdMs: 200, smoothing: .5, scaleGain: 1, scaleDeadZone: .02, rotationDeadZone: .02, nearSize: .24, farSize: .12, mode: 'full' as const };
const area = (object: BoardObject) => Math.abs(signedArea(objectOutline(object)));
function fistLandmarks(): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .65 })); p[0] = { x: .5, y: .82 };
  [5, 9, 13, 17].forEach((base, finger) => { const x = .38 + finger * .08; p[base] = { x, y: .58 }; p[base + 1] = { x, y: .5 }; p[base + 2] = { x: x + .025, y: .56 }; p[base + 3] = { x: x + .035, y: .63 }; });
  p[1] = { x: .45, y: .7 }; p[2] = { x: .43, y: .66 }; p[3] = { x: .46, y: .64 }; p[4] = { x: .5, y: .66 }; return p;
}

describe('fist manipulation from one immutable baseline', () => {
  it('recognizes a folded fist from aspect-correct articulation', () => expect(classifyFistManipulation(fistLandmarks(), { width: 1280, height: 720 }).active).toBe(true));
  it('requires a selection and stable acquisition without jumping', () => {
    const controller = new FistManipulationController(), object = rectangle();
    expect(controller.update(pose(), { x: 300, y: 260 }, [], false, 0, options).preview).toBeUndefined();
    expect(controller.state).toBe('IDLE');
    controller.update(pose(), { x: 300, y: 260 }, [object], true, 0, options);
    const acquired = controller.update(pose(), { x: 300, y: 260 }, [object], true, 200, options);
    expect(controller.state).toBe('GRABBED'); expect(acquired.preview).toEqual([object]);
  });
  it('combines mapped translation, relative apparent size and wrapped image-plane rotation without cumulative drift', () => {
    const controller = new FistManipulationController(), object = rectangle();
    controller.update(pose(), { x: 300, y: 260 }, [object], true, 0, options);
    controller.update(pose(), { x: 300, y: 260 }, [object], true, 200, options);
    const changed = controller.update(pose({ apparentSize: .21, orientation: -3.08 }), { x: 380, y: 300 }, [object], true, 240, options);
    expect(changed.translation.x).toBe(40); expect(changed.translation.y).toBe(20);
    expect(changed.scale).toBeGreaterThan(1); expect(Math.abs(changed.angle)).toBeLessThan(.1);
    expect(changed.preview).toEqual(manipulateSelection([object], changed.translation, changed.scale, changed.angle));
    const second = controller.update(pose({ apparentSize: .21, orientation: -3.08 }), { x: 380, y: 300 }, [object], true, 280, options);
    expect(second.preview).toEqual(manipulateSelection([object], second.translation, second.scale, second.angle));
  });
  it('freezes ambiguous rotation-induced size jumps while movement continues', () => {
    const controller = new FistManipulationController(), object = rectangle();
    controller.update(pose({ orientation: 0 }), { x: 300, y: 260 }, [object], true, 0, options);
    controller.update(pose({ orientation: 0 }), { x: 300, y: 260 }, [object], true, 200, options);
    const changed = controller.update(pose({ apparentSize: .22, orientation: .3 }), { x: 340, y: 260 }, [object], true, 240, options);
    expect(changed.scale).toBe(1); expect(changed.translation.x).toBe(20); expect(changed.rejection).toMatch(/Ambiguous/);
  });
  it('commits once on deliberate opening, round-trips exactly, transforms groups, and cancels tracking loss', () => {
    const controller = new FistManipulationController(), first = rectangle('a'), second = { ...rectangle('b'), x: 600 };
    controller.update(pose({ orientation: 0 }), { x: 300, y: 260 }, [first, second], true, 0, options);
    controller.update(pose({ orientation: 0 }), { x: 300, y: 260 }, [first, second], true, 200, options);
    controller.update(pose({ orientation: .2, apparentSize: .2 }), { x: 360, y: 290 }, [first, second], true, 240, options);
    expect(controller.update(pose({ active: false }), { x: 360, y: 290 }, [first, second], true, 300, options).commit).toBeUndefined();
    const committed = controller.update(pose({ active: false }), { x: 360, y: 290 }, [first, second], true, 400, options).commit!;
    expect(committed.after).toHaveLength(2); expect(controller.update(pose({ active: false }), { x: 0, y: 0 }, [first, second], false, 450, options).commit).toBeUndefined();
    const state = initialState(); reduce(state, { type: 'create-object', object: first }); reduce(state, { type: 'create-object', object: second });
    reduce(state, { type: 'transform-objects', ...committed }); expect(currentObjects(state.history)).toEqual(committed.after);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)).toEqual(committed.before);
    reduce(state, { type: 'redo' }); expect(currentObjects(state.history)).toEqual(committed.after);
    const cancelled = new FistManipulationController(); cancelled.update(pose(), { x: 300, y: 260 }, [first], true, 0, options); cancelled.update(pose(), { x: 300, y: 260 }, [first], true, 200, options); cancelled.trackingLost();
    expect(cancelled.state).toBe('WAITING_FOR_RELEASE'); expect(cancelled.scale).toBe(1);
  });
});

const scissorPose = (kind: 'open' | 'closed' | 'invalid'): ScissorPose => ({ validArticulation: kind !== 'invalid', open: kind === 'open', closed: kind === 'closed', confidence: kind === 'invalid' ? 0 : .9, separation: kind === 'open' ? .5 : .15, guideAnchor: { x: .5, y: .5 }, guideDirection: { x: 1, y: 0 } });
function scissorLandmarks(open = true): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .65 })); p[0] = { x: .5, y: .85 };
  const bases = [.42, .5, .58, .66];
  [5, 9, 13, 17].forEach((base, finger) => {
    const x = bases[finger]; p[base] = { x, y: .62 }; p[base + 1] = { x, y: finger < 2 ? .48 : .66 }; p[base + 2] = { x, y: finger < 2 ? .34 : .69 };
    p[base + 3] = finger === 0 ? { x: open ? .38 : .48, y: .2 } : finger === 1 ? { x: open ? .54 : .5, y: .18 } : { x: x - .01, y: .64 };
  });
  p[1] = { x: .44, y: .7 }; p[2] = { x: .42, y: .68 }; p[3] = { x: .43, y: .67 }; p[4] = { x: .45, y: .68 }; return p;
}

describe('scissor recognition and snip state machine', () => {
  it('recognizes the two extended/two folded articulation and distinct open/close thresholds', () => {
    const open = classifyScissors(scissorLandmarks(true), { width: 1000, height: 1000 });
    const closed = classifyScissors(scissorLandmarks(false), { width: 1000, height: 1000 });
    expect(open.validArticulation).toBe(true); expect(open.open).toBe(true);
    expect(closed.validArticulation).toBe(true); expect(closed.closed).toBe(true);
  });
  it('requires a stable open pose, does not snip a stationary V, fires once, and rearms only after reopen', () => {
    const controller = new ScissorController(180, 50), point = { x: 400, y: 300 }, direction = { x: 1, y: 0 };
    expect(controller.update(scissorPose('open'), point, direction, 0).snip).toBe(false);
    expect(controller.update(scissorPose('open'), point, direction, 180).state).toBe('GUIDE_ACTIVE');
    expect(controller.update(scissorPose('open'), point, direction, 500).snip).toBe(false);
    expect(controller.update(scissorPose('closed'), point, direction, 520).snip).toBe(false);
    expect(controller.update(scissorPose('closed'), point, direction, 570).snip).toBe(true);
    controller.committed(); expect(controller.update(scissorPose('closed'), point, direction, 600).snip).toBe(false);
    expect(controller.update(scissorPose('open'), point, direction, 700).state).toBe('OPEN_SCISSORS');
  });
});

const tracked = (points: Point[], hand: 'Left' | 'Right'): TrackingResult => ({ kind: 'result', frameId: 1, status: 'hands', landmarks: points, allLandmarks: [points], duration: 1, timestamp: 1,
  stats: { framesReceived: 1, inferenceCalls: 1, successfulInferences: 1, failedFrames: 0, frameId: 1, inputWidth: 1000, inputHeight: 1000, duration: 1, landmarksArrayCount: 1, detectedHandCount: 1, landmarkCounts: [21], handedness: [[{ categoryName: hand, score: .99 }]], lastSuccessAt: 1, lastError: null, threshold: .65 } });
function interaction(state: ReturnType<typeof initialState>): InteractionController {
  return new InteractionController({ send: command => reduce(state, command), routePinch() {}, endPinch() {}, map: point => ({ x: point.x * 1600, y: point.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
}
function cutReadyState(mode: 'move' | 'cut' = 'cut') {
  const state = initialState(), source: BoardObject = { id: 'target', type: 'rectangle', x: 600, y: 100, width: 300, height: 180, color: '#225c4a', strokeWidth: 5, text: '' };
  reduce(state, { type: 'create-object', object: source }); reduce(state, { type: 'select', ids: [source.id] }); state.settings.objectGestureMode = mode; return state;
}
function performSnip(controller: InteractionController, state: ReturnType<typeof initialState>, hand: 'Left' | 'Right') {
  const size = { width: 1000, height: 1000 };
  controller.update(tracked(scissorLandmarks(true), hand), size, 0, state.settings);
  controller.update(tracked(scissorLandmarks(true), hand), size, 180, state.settings);
  controller.update(tracked(scissorLandmarks(false), hand), size, 200, state.settings);
  controller.update(tracked(scissorLandmarks(false), hand), size, 260, state.settings);
}

describe('central interaction authority gates cutting', () => {
  it('does not cut outside explicit Cut mode', () => {
    const state = cutReadyState('move'); performSnip(interaction(state), state, 'Right');
    expect(state.history.actions.some(action => action.kind === 'cut')).toBe(false); expect(currentObjects(state.history)).toHaveLength(1);
  });
  it('does not route the complementary hand to cutting', () => {
    const state = cutReadyState('cut'); performSnip(interaction(state), state, 'Left');
    expect(state.history.actions.some(action => action.kind === 'cut')).toBe(false); expect(currentObjects(state.history)).toHaveLength(1);
  });
  it('accepts one dominant-hand snip only in Cut mode', () => {
    const state = cutReadyState('cut'), controller = interaction(state); performSnip(controller, state, 'Right');
    expect(state.history.actions.filter(action => action.kind === 'cut')).toHaveLength(1); expect(currentObjects(state.history)).toHaveLength(2); expect(state.selection).toEqual([]);
    performSnip(controller, state, 'Right'); expect(state.history.actions.filter(action => action.kind === 'cut')).toHaveLength(1);
  });
  it('lets an active tablet or stylus stroke retain ownership', () => {
    const cutState = cutReadyState('cut'); reduce(cutState, { type: 'begin', id: 'tablet-stroke', brush: cutState.settings.brush, point: { x: 20, y: 20 } });
    performSnip(interaction(cutState), cutState, 'Right'); expect(cutState.history.active?.id).toBe('tablet-stroke'); expect(cutState.history.actions.some(action => action.kind === 'cut')).toBe(false);
    const fistState = initialState(), source = { ...rectangle(), x: 650, y: 500 }; reduce(fistState, { type: 'create-object', object: source }); reduce(fistState, { type: 'select', ids: [source.id] }); fistState.settings.objectGestureMode = 'full';
    reduce(fistState, { type: 'begin', id: 'pad-stroke', brush: fistState.settings.brush, point: { x: 30, y: 30 } }); const controller = interaction(fistState);
    controller.update(tracked(fistLandmarks(), 'Right'), { width: 1000, height: 1000 }, 0, fistState.settings); controller.update(tracked(fistLandmarks(), 'Right'), { width: 1000, height: 1000 }, 220, fistState.settings);
    expect(fistState.history.active?.id).toBe('pad-stroke'); expect(fistState.history.actions.some(action => action.kind === 'transform')).toBe(false);
  });
});

describe('positional cutting and atomic history', () => {
  let serial = 0; const ids = () => `cut-${++serial}`;
  it('cuts a rotated line at the displayed intersection and conserves length', () => {
    const source: BoardObject = { id: 'line', type: 'line', x: 160, y: 180, width: 500, height: 200, color: '#225c4a', strokeWidth: 4, text: '', rotation: .35 };
    const [a, b] = objectOutline(source), midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, axis = { x: b.x - a.x, y: b.y - a.y };
    const result = cutObject(source, { point: midpoint, direction: { x: -axis.y, y: axis.x } }, ids)!;
    const lengths = result.pieces.map(piece => { const [x, y] = objectOutline(piece); return Math.hypot(y.x - x.x, y.y - x.y); });
    expect(result.pieces).toHaveLength(2); expect(lengths[0] + lengths[1]).toBeCloseTo(Math.hypot(axis.x, axis.y), 4);
  });
  it.each(['triangle', 'rectangle', 'polygon'] as const)('clips a rotated/convex %s into exactly two area-conserving regions', type => {
    const source: BoardObject = type === 'triangle'
      ? { ...rectangle(type), type, vertices: [{ x: 320, y: 160 }, { x: 500, y: 420 }, { x: 120, y: 420 }], x: 120, y: 160, width: 380, height: 260, rotation: .15 }
      : type === 'polygon' ? { ...rectangle(type), type, vertices: [{ x: 140, y: 220 }, { x: 300, y: 140 }, { x: 500, y: 220 }, { x: 460, y: 420 }, { x: 180, y: 430 }], x: 140, y: 140, width: 360, height: 290, rotation: .12 }
      : { ...rectangle(type), rotation: .3 };
    const outline = objectOutline(source), center = outline.reduce((sum, point) => ({ x: sum.x + point.x / outline.length, y: sum.y + point.y / outline.length }), { x: 0, y: 0 });
    const result = cutObject(source, { point: center, direction: { x: .25, y: 1 } }, ids)!;
    expect(result.pieces).toHaveLength(2); expect(area(result.pieces[0]) + area(result.pieces[1])).toBeCloseTo(area(source), 4);
  });
  it('rejects misses, tangents, unsupported and sliver cuts', () => {
    const source = rectangle();
    expect(cutObject(source, { point: { x: 20, y: 20 }, direction: { x: 1, y: 0 } }, ids)).toBeNull();
    expect(cutObject(source, { point: { x: 200, y: 200 }, direction: { x: 1, y: 0 } }, ids)).toBeNull();
    expect(cutObject({ ...source, type: 'ellipse' }, { point: { x: 320, y: 260 }, direction: { x: 1, y: 0 } }, ids)).toBeNull();
    expect(cutObject(source, { point: { x: 202, y: 260 }, direction: { x: 0, y: 1 } }, ids)).toBeNull();
  });
  it('commits once, clears selection, rejects duplicate/stale commands, and round-trips exact IDs', () => {
    const state = initialState(), source = rectangle(); reduce(state, { type: 'create-object', object: source }); reduce(state, { type: 'select', ids: [source.id] });
    const line: CutLine = { point: { x: 320, y: 260 }, direction: { x: 0, y: 1 } }, result = cutObject(source, line, ids)!;
    const command = { type: 'cut-object' as const, source, pieces: result.pieces, line: result.line };
    expect(validCommand(command)).toBe(true); reduce(state, command); reduce(state, command);
    expect(state.history.actions.filter(action => action.kind === 'cut')).toHaveLength(1); expect(state.selection).toEqual([]); expect(currentObjects(state.history)).toEqual(result.pieces);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)).toEqual([source]);
    reduce(state, { type: 'redo' }); expect(currentObjects(state.history)).toEqual(result.pieces); expect(validState(state)).toBe(true);
  });
});
