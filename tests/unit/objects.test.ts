import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/core/settings';
import { currentObjects, currentStrokes } from '../../src/drawing/history';
import { nearestObject, selectObjects } from '../../src/drawing/objects';
import { reduce, validBoardObject, validCommand, validState } from '../../src/sync/protocol';
import type { BoardObject } from '../../src/core/types';

const shape = (id: string, type: BoardObject['type'] = 'rectangle'): BoardObject => ({ id, type, x: 100, y: 100, width: 200, height: 120, color: '#225c4a', strokeWidth: 6, text: '' });
describe('native board objects', () => {
  it('creates, updates, moves, deletes and undoes on one history timeline', () => {
    const state = initialState();
    reduce(state, { type: 'create-object', object: shape('box') });
    reduce(state, { type: 'update-object', object: { ...shape('box'), text: 'Database' } });
    reduce(state, { type: 'move', ids: ['box'], dx: 40, dy: 20 });
    expect(currentObjects(state.history)[0]).toMatchObject({ x: 140, y: 120, text: 'Database' });
    reduce(state, { type: 'delete-object', id: 'box' }); expect(currentObjects(state.history)).toHaveLength(0);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)).toHaveLength(1);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)[0].x).toBe(100);
    reduce(state, { type: 'redo' }); expect(currentObjects(state.history)[0].x).toBe(140);
    expect(validState(state)).toBe(true);
  });
  it('replaces a stroke reversibly and commits a diagram as one action', () => {
    const state = initialState();
    reduce(state, { type: 'begin', id: 'rough', brush: state.settings.brush, point: { x: 100, y: 100 } });
    reduce(state, { type: 'point', id: 'rough', point: { x: 200, y: 200 } });
    reduce(state, { type: 'end', id: 'rough' });
    reduce(state, { type: 'replace-stroke', strokeId: 'rough', object: shape('clean', 'ellipse') });
    expect(currentStrokes(state.history)).toHaveLength(0);
    reduce(state, { type: 'undo' }); expect(currentStrokes(state.history)[0].id).toBe('rough');
    reduce(state, { type: 'redo' });
    reduce(state, { type: 'create-diagram', objects: [shape('a'), shape('b'), shape('edge', 'connector')], requestId: 'request', baseRevision: 0 });
    expect(currentObjects(state.history)).toHaveLength(4);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history)).toHaveLength(1);
  });
  it('hit tests and lasso selects native geometry', () => {
    const objects = [shape('box'), shape('arrow', 'arrow')];
    expect(nearestObject(objects, { x: 150, y: 150 }, 5)?.id).toBe('box');
    expect(selectObjects([shape('box')], [{ x: 50, y: 50 }, { x: 350, y: 50 }, { x: 350, y: 270 }, { x: 50, y: 270 }])).toEqual(['box']);
  });
  it('keeps connectors attached when nodes move and hides dangling connectors', () => {
    const state = initialState();
    const a = shape('a'), b = { ...shape('b'), x: 500 };
    const edge: BoardObject = { ...shape('edge', 'connector'), x: 300, y: 150, width: 200, height: 1, fromId: 'a', toId: 'b' };
    reduce(state, { type: 'create-diagram', objects: [edge, a, b], requestId: 'r', baseRevision: 0 });
    const before = currentObjects(state.history).find(item => item.id === 'edge')!;
    reduce(state, { type: 'move', ids: ['b'], dx: 100, dy: 0 });
    const after = currentObjects(state.history).find(item => item.id === 'edge')!;
    expect(after.width).toBeGreaterThan(before.width);
    reduce(state, { type: 'delete-object', id: 'b' });
    expect(currentObjects(state.history).some(item => item.id === 'edge')).toBe(false);
    reduce(state, { type: 'undo' }); expect(currentObjects(state.history).some(item => item.id === 'edge')).toBe(true);
  });
  it('rejects invalid native objects and oversized diagram transactions', () => {
    expect(validBoardObject({ ...shape('a'), x: NaN })).toBe(false);
    expect(validBoardObject({ ...shape('a'), text: '<script>' })).toBe(false);
    expect(validBoardObject({ ...shape('a'), x: 1500 })).toBe(false);
    expect(validCommand({ type: 'create-diagram', objects: [shape('a'), shape('a')], requestId: 'r', baseRevision: 0 })).toBe(false);
  });
});
