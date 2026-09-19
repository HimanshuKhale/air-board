import { describe, expect, it } from 'vitest';
import { makeShape } from '../../src/drawing/geometry';
import { nearestShapeHandle, shapeHandles, transformObject } from '../../src/drawing/transform';
import type { BoardObject } from '../../src/core/types';
import { validBoardObject } from '../../src/sync/protocol';
import { initialState } from '../../src/core/settings';
import { currentObjects } from '../../src/drawing/history';
import { reduce } from '../../src/sync/protocol';

const shape = (type: BoardObject['type'] = 'rectangle') => makeShape(type, 'shape', 100, 100, 200, 120, '#225c4a', 5);

describe('native shape handles', () => {
  it('creates every palette shape as protocol-valid geometry', () => {
    for (const type of ['triangle', 'square', 'rectangle', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'polygon', 'circle', 'ellipse', 'line', 'arrow'] as const)
      expect(validBoardObject(makeShape(type, type, 80, 80, 220, 140, '#225c4a', 5)), type).toBe(true);
  });
  it('proportionally scales from an immutable opposite corner', () => {
    const object = shape(), handle = shapeHandles(object, 'scale', 'proportional').find(item => item.id === 'se')!;
    const resized = transformObject(object, handle, { x: 500, y: 400 }, 'proportional')!;
    expect(resized.width / resized.height).toBeCloseTo(object.width / object.height, 4);
    expect(resized.x).toBe(100); expect(resized.y).toBe(100);
  });
  it('free resize converts a square to a rectangle and a circle to an ellipse', () => {
    const square = shape('square'), corner = shapeHandles(square, 'scale', 'free').find(item => item.id === 'se')!;
    expect(transformObject(square, corner, { x: 430, y: 260 }, 'free')?.type).toBe('rectangle');
    const circle = shape('circle'), radius = shapeHandles(circle, 'scale', 'free').find(item => item.id === 'radius-e')!;
    expect(transformObject(circle, radius, { x: 400, y: 175 }, 'free')?.type).toBe('ellipse');
  });
  it('keeps an ellipse aspect ratio in proportional radius mode', () => {
    const ellipse = shape('ellipse'), radius = shapeHandles(ellipse, 'scale', 'proportional').find(item => item.id === 'radius-e')!;
    const resized = transformObject(ellipse, radius, { x: 350, y: 160 }, 'proportional')!;
    expect(resized.width / resized.height).toBeCloseTo(ellipse.width / ellipse.height, 5);
  });
  it('edits polygon vertices and edges while retaining a valid polygon', () => {
    const polygon = shape('hexagon'), handles = shapeHandles(polygon, 'points', 'free');
    const vertex = handles.find(item => item.id === 'vertex-0')!;
    const edited = transformObject(polygon, vertex, { x: vertex.point.x + 20, y: vertex.point.y + 12 }, 'free')!;
    expect(edited.type).toBe('polygon'); expect(edited.vertices?.[0]).not.toEqual(polygon.vertices?.[0]);
    const edge = shapeHandles(edited, 'points', 'free').find(item => item.id === 'edge-1')!;
    expect(transformObject(edited, edge, { x: edge.point.x + 10, y: edge.point.y + 10 }, 'free')?.vertices).toHaveLength(6);
    const rectangle = shape(), top = shapeHandles(rectangle, 'points', 'free').find(item => item.id === 'edge-0')!;
    expect(transformObject(rectangle, top, { x: top.point.x, y: top.point.y - 20 }, 'free')?.type).toBe('rectangle');
  });
  it('moves line endpoints and enforces board and minimum-size bounds', () => {
    const line = shape('line'), endpoint = shapeHandles(line, 'scale', 'free')[1];
    expect(transformObject(line, endpoint, { x: 450, y: 300 }, 'free')).toMatchObject({ width: 350, height: 200 });
    expect(transformObject(line, endpoint, { x: 100, y: 100 }, 'free')).toBeNull();
    expect(nearestShapeHandle(shapeHandles(line, 'scale', 'free'), { x: 100, y: 100 })).not.toBeNull();
  });
  it('rejects a self-intersecting vertex edit and undo/redo restore exact geometry', () => {
    const polygon = makeShape('square', 'shape', 100, 100, 160, 160, '#225c4a', 5);
    const vertex = shapeHandles(polygon, 'points', 'free').find(item => item.id === 'vertex-0')!;
    expect(transformObject(polygon, vertex, { x: 300, y: 200 }, 'free')).toBeNull();
    const corner = shapeHandles(polygon, 'scale', 'free').find(item => item.id === 'se')!;
    const resized = transformObject(polygon, corner, { x: 330, y: 300 }, 'free')!;
    const state = initialState(); reduce(state, { type: 'create-object', object: polygon });
    const before = state.history.actions.length; reduce(state, { type: 'update-object', object: resized });
    expect(state.history.actions).toHaveLength(before + 1); expect(currentObjects(state.history)[0]).toEqual(resized);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)[0]).toEqual(polygon);
    reduce(state, { type: 'redo' }); expect(currentObjects(state.history)[0]).toEqual(resized);
  });
});
