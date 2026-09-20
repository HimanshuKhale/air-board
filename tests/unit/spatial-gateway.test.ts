import { describe, expect, it } from 'vitest';
import type { BoardObject, Point } from '../../src/core/types';
import { initialState } from '../../src/core/settings';
import { signedArea } from '../../src/drawing/geometry';
import { currentObjects } from '../../src/drawing/history';
import { distanceToObject, objectBounds, objectOutline } from '../../src/drawing/objects';
import { normalizeAngle, transformSelection } from '../../src/drawing/spatial';
import { subdivide } from '../../src/drawing/subdivision';
import { shapeHandles, transformObject } from '../../src/drawing/transform';
import { ChopController } from '../../src/interaction/chop';
import { classifyThreeFingerTransform, SpatialTransformController } from '../../src/interaction/three-finger-transform';
import { reduce, validCommand, validState } from '../../src/sync/protocol';
import { selectObjects } from '../../src/drawing/objects';

const rectangle = (id = 'rect'): BoardObject => ({ id, type: 'rectangle', x: 200, y: 200, width: 240, height: 120, color: '#225c4a', strokeWidth: 5, text: '', rotation: 0 });
const area = (object: BoardObject) => Math.abs(signedArea(objectOutline(object)));

describe('serialized rotation and group transforms', () => {
  it('rotates editable geometry around its center for bounds and hit testing', () => {
    const object = { ...rectangle(), rotation: Math.PI / 2 };
    const outline = objectOutline(object), bounds = objectBounds(object);
    expect(outline[0]).toMatchObject({ x: 380, y: 140 });
    expect(bounds.width).toBeCloseTo(120); expect(bounds.height).toBeCloseTo(240);
    expect(distanceToObject({ x: 320, y: 260 }, object)).toBe(0);
    expect(validCommand({ type: 'create-object', object })).toBe(true);
  });
  it('scales and rotates a group around one pivot while preserving IDs and relative layout', () => {
    const before = [{ ...rectangle('a'), y: 360 }, { ...rectangle('b'), x: 600, y: 380, width: 120, height: 80 }];
    const after = transformSelection(before, 1.5, Math.PI / 2)!;
    expect(after.map(object => object.id)).toEqual(['a', 'b']);
    expect(after[0].width).toBe(360); expect(after[1].height).toBe(120);
    expect(after[0].rotation).toBeCloseTo(Math.PI / 2);
    const beforeDistance = Math.hypot((before[1].x + 60) - (before[0].x + 120), (before[1].y + 40) - (before[0].y + 60));
    const afterDistance = Math.hypot((after[1].x + 90) - (after[0].x + 180), (after[1].y + 60) - (after[0].y + 90));
    expect(afterDistance).toBeCloseTo(beforeDistance * 1.5);
  });
  it('normalizes serialized angles', () => expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI));
  it('rotates resize handles and keeps lasso selection on world geometry', () => {
    const object = { ...rectangle(), rotation: Math.PI / 4 };
    const handles = shapeHandles(object, 'scale', 'proportional'), southeast = handles.find(handle => handle.id === 'se')!;
    expect(southeast.point.x).not.toBeCloseTo(object.x + object.width);
    const resized = transformObject(object, southeast, { x: southeast.point.x + 40, y: southeast.point.y + 40 }, 'proportional');
    expect(resized?.rotation).toBeCloseTo(Math.PI / 4);
    const box = objectBounds(object), lasso = [{ x: box.x - 5, y: box.y - 5 }, { x: box.x + box.width + 5, y: box.y - 5 }, { x: box.x + box.width + 5, y: box.y + box.height + 5 }, { x: box.x - 5, y: box.y + box.height + 5 }];
    expect(selectObjects([object], lasso)).toEqual([object.id]);
  });
});

describe('mathematical subdivision', () => {
  let id = 0; const ids = () => `piece-${++id}`;
  it('divides a rotated line into equal contiguous segments and keeps one terminal arrowhead', () => {
    const line: BoardObject = { id: 'line', type: 'arrow', x: 180, y: 240, width: 360, height: 180, color: '#123456', strokeWidth: 7, text: '', rotation: .37 };
    const result = subdivide(line, 3, 'equal-area', ids)!;
    expect(result.method).toBe('equal-length'); expect(result.pieces).toHaveLength(3);
    const original = objectOutline(line), segments = result.pieces.map(objectOutline);
    const originalLength = Math.hypot(original[1].x - original[0].x, original[1].y - original[0].y);
    expect(segments.map(segment => Math.hypot(segment[1].x - segment[0].x, segment[1].y - segment[0].y))).toEqual(expect.arrayContaining([expect.closeTo(originalLength / 3, 5), expect.closeTo(originalLength / 3, 5), expect.closeTo(originalLength / 3, 5)]));
    expect(segments[0][1].x).toBeCloseTo(segments[1][0].x); expect(segments[1][1].y).toBeCloseTo(segments[2][0].y);
    expect(result.pieces.map(piece => piece.type)).toEqual(['line', 'line', 'arrow']);
  });
  it('makes exactly three equal-area triangles without claiming similarity', () => {
    const triangle: BoardObject = { id: 'tri', type: 'triangle', x: 200, y: 120, width: 360, height: 300, color: '#225c4a', strokeWidth: 5, text: '', vertices: [{ x: 380, y: 120 }, { x: 560, y: 420 }, { x: 200, y: 420 }] };
    const result = subdivide(triangle, 3, 'equal-area', ids)!;
    expect(result.method).toBe('equal-area'); expect(result.pieces).toHaveLength(3);
    expect(result.pieces.every(piece => piece.type === 'triangle')).toBe(true);
    for (const piece of result.pieces) expect(area(piece)).toBeCloseTo(area(triangle) / 3, 5);
  });
  it('supports the four-triangle medial construction as an explicit similar mode', () => {
    const triangle: BoardObject = { id: 'tri', type: 'triangle', x: 100, y: 100, width: 300, height: 240, color: '#225c4a', strokeWidth: 4, text: '', vertices: [{ x: 250, y: 100 }, { x: 400, y: 340 }, { x: 100, y: 340 }] };
    const result = subdivide(triangle, 4, 'similar', ids)!;
    expect(result.method).toBe('similar'); expect(result.pieces).toHaveLength(4);
    for (const piece of result.pieces) expect(area(piece)).toBeCloseTo(area(triangle) / 4, 5);
    expect(subdivide(triangle, 3, 'similar', ids)).toBeNull();
  });
  it('partitions a convex polygon with area conservation and rejects concavity', () => {
    const polygon: BoardObject = { id: 'poly', type: 'polygon', x: 100, y: 100, width: 500, height: 360, color: '#225c4a', strokeWidth: 4, text: '', vertices: [{ x: 100, y: 180 }, { x: 260, y: 100 }, { x: 520, y: 130 }, { x: 600, y: 340 }, { x: 360, y: 460 }, { x: 140, y: 380 }] };
    const result = subdivide(polygon, 5, 'equal-area', ids)!;
    expect(result.pieces).toHaveLength(5);
    expect(result.pieces.reduce((sum, piece) => sum + area(piece), 0)).toBeCloseTo(area(polygon), 4);
    const concave = { ...polygon, id: 'concave', vertices: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 250, y: 220 }, { x: 500, y: 400 }, { x: 100, y: 400 }] };
    expect(subdivide(concave, 3, 'equal-area', ids)).toBeNull();
  });
});

describe('atomic spatial history', () => {
  it('commits one group transform and round-trips undo/redo', () => {
    const state = initialState(), first = rectangle('a'), second = { ...rectangle('b'), x: 600 };
    reduce(state, { type: 'create-object', object: first }); reduce(state, { type: 'create-object', object: second });
    const before = currentObjects(state.history), after = transformSelection(before, 1.2, .2)!;
    reduce(state, { type: 'transform-objects', before, after, mode: 'scale-rotate' });
    expect(state.history.actions.at(-1)?.kind).toBe('transform'); expect(currentObjects(state.history)).toEqual(after);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)).toEqual(before);
    reduce(state, { type: 'redo' }); expect(currentObjects(state.history)).toEqual(after);
    expect(validState(state)).toBe(true);
  });
  it('subdivides atomically, preserves piece IDs on redo, and rejects duplicate application', () => {
    const state = initialState(), source: BoardObject = { id: 'source', type: 'line', x: 100, y: 100, width: 600, height: 240, color: '#225c4a', strokeWidth: 4, text: '' };
    reduce(state, { type: 'create-object', object: source });
    let serial = 0; const result = subdivide(source, 3, 'equal-area', () => `fixed-${++serial}`)!;
    const command = { type: 'subdivide-object' as const, source, pieces: result.pieces, method: result.method, pieceCount: 3 };
    expect(validCommand(command)).toBe(true); reduce(state, command); reduce(state, command);
    expect(state.history.actions.filter(action => action.kind === 'subdivide')).toHaveLength(1);
    expect(currentObjects(state.history).map(object => object.id)).toEqual(['fixed-1', 'fixed-2', 'fixed-3']);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)).toEqual([source]);
    reduce(state, { type: 'redo' }); expect(currentObjects(state.history).map(object => object.id)).toEqual(['fixed-1', 'fixed-2', 'fixed-3']);
  });
});

function transformHand(): Point[] {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .6 })); points[0] = { x: .5, y: .82 };
  points[1] = { x: .48, y: .72 }; points[2] = { x: .46, y: .64 }; points[3] = { x: .48, y: .65 }; points[4] = { x: .5, y: .69 };
  [5, 9, 13, 17].forEach((base, finger) => {
    const x = .35 + finger * .1; points[base] = { x, y: .6 };
    if (finger === 0) { points[base + 1] = { x, y: .52 }; points[base + 2] = { x: x + .04, y: .58 }; points[base + 3] = { x: x + .015, y: .69 }; }
    else { points[base + 1] = { x, y: .49 }; points[base + 2] = { x: x + .04, y: .39 }; points[base + 3] = { x: x + .10, y: .38 }; }
  });
  return points;
}

describe('three-finger transform and chop temporal rules', () => {
  it('recognizes a deliberate mid-range three-finger pose and rejects a fist', () => {
    expect(classifyThreeFingerTransform(transformHand(), { width: 1000, height: 1000 }).active).toBe(true);
    const fist = transformHand(); [8, 12, 16, 20].forEach(index => { fist[index] = { x: fist[index - 3].x + .01, y: .69 }; });
    expect(classifyThreeFingerTransform(fist, { width: 1000, height: 1000 }).active).toBe(false);
  });
  it('holds before entry, scales from the baseline, commits once on release, and unwraps rotation', () => {
    const object = rectangle(), scale = new SpatialTransformController(200), pose = { active: true, confidence: .9, extension: .5, angle: 3.10, anchor: { x: .5, y: .5 } };
    expect(scale.update(pose, [object], 'scale', 0).preview).toBeUndefined();
    expect(scale.update(pose, [object], 'scale', 200).preview).toHaveLength(1);
    const grown = scale.update({ ...pose, extension: .8 }, [object], 'scale', 240);
    expect(grown.scale).toBeGreaterThan(1); expect(grown.angle).toBe(0); expect(grown.preview![0].width).toBeGreaterThan(object.width);
    const committed = scale.update({ ...pose, active: false }, [object], 'scale', 260).commit;
    expect(committed?.after[0].width).toBeGreaterThan(object.width);
    expect(scale.update({ ...pose, active: false }, [object], 'scale', 280).commit).toBeUndefined();
    const rotate = new SpatialTransformController(0);
    rotate.update(pose, [object], 'rotate', 0); rotate.update(pose, [object], 'rotate', 1);
    const wrapped = rotate.update({ ...pose, angle: -3.10 }, [object], 'rotate', 2);
    expect(Math.abs(wrapped.angle)).toBeLessThan(.1); expect(wrapped.scale).toBe(1);
    const shrink = new SpatialTransformController(0);
    shrink.update(pose, [object], 'scale', 0); shrink.update(pose, [object], 'scale', 1);
    expect(shrink.update({ ...pose, extension: .25 }, [object], 'scale', 2).preview![0].width).toBeLessThan(object.width);
  });
  it('counts completed swipes once, requires return, caps repeats, and finalizes after inactivity', () => {
    const chops = new ChopController(1200), size = { width: 1000, height: 1000 }, pose = (x: number, active = true) => ({ active, confidence: active ? .9 : 0, center: { x, y: .5 }, scale: 200 });
    chops.update(pose(.2), size, 0);
    expect(chops.update(pose(.32), size, 100)).toMatchObject({ counted: true, count: 1 });
    expect(chops.update(pose(.45), size, 150)).toMatchObject({ counted: false, count: 1 });
    chops.update(pose(.45, false), size, 200); chops.update(pose(.45), size, 250);
    expect(chops.update(pose(.33), size, 350)).toMatchObject({ counted: true, count: 2 });
    expect(chops.tick(1549).finalize).toBe(false); expect(chops.tick(1550)).toMatchObject({ count: 2, finalize: true });
  });
  it('treats one chop as one requested piece and never as a destructive split', () => {
    const chops = new ChopController(1200), size = { width: 1000, height: 1000 };
    chops.update({ active: true, confidence: .9, center: { x: .2, y: .5 }, scale: 200 }, size, 0);
    chops.update({ active: true, confidence: .9, center: { x: .32, y: .5 }, scale: 200 }, size, 100);
    expect(chops.tick(1300)).toEqual({ counted: false, count: 1, finalize: true });
    expect(subdivide(rectangle(), 1)).toBeNull();
  });
});
