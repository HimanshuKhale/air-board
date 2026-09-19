import { expect, it } from 'vitest';
import { parseCommand } from '../../src/ai/commands';
import { composeDiagram, validDiagramPlan } from '../../src/ai/plan';
import { initialState } from '../../src/core/settings';
import { reduce, validCommand } from '../../src/sync/protocol';
import { AutomaticPlanner } from '../../src/ai/automatic';

it('parses English, Hindi and Hinglish explicit commands', () => {
  expect(parseCommand('AirBoard, ek rectangle banao')).toMatchObject({ kind: 'create', type: 'rectangle', count: 1 });
  expect(parseCommand('AirBoard, teen boxes banao')).toMatchObject({ kind: 'create', type: 'rectangle', count: 3 });
  expect(parseCommand('Is box ko database naam do', true)).toMatchObject({ kind: 'label', text: 'database' });
  expect(parseCommand('Connect the API to the database', true)).toMatchObject({ kind: 'connect', from: 'api', to: 'database' });
  expect(parseCommand('Ye arrow red kar do', true)).toMatchObject({ kind: 'recolor', color: '#da5650' });
  expect(parseCommand('Ab model training ke neeche deployment add karo', true)).toMatchObject({ kind: 'add-below', anchor: 'model training', label: 'deployment' });
  expect(parseCommand('AirBoard, एक आयत बनाओ')).toMatchObject({ kind: 'create', type: 'rectangle' });
  expect(parseCommand('create a flowchart with data collection, model training and deployment')).toBeNull();
});
it('automatic planning groups finalized segments and never edits the board', () => {
  const planner = new AutomaticPlanner(), state = initialState();
  expect(planner.ingest('Today we discuss model training', { revision: 0, history: state.history, selectedIds: [], manipulating: false, now: 1000 })).toBeNull();
  const suggestion = planner.ingest('Data collection leads to model training', { revision: 0, history: state.history, selectedIds: [], manipulating: false, now: 2500 });
  expect(suggestion?.plan?.nodes).toHaveLength(2);
  expect(state.history.position).toBe(0);
  expect(planner.ingest('Data collection leads to model training', { revision: 0, history: state.history, selectedIds: [], manipulating: false, now: 2600 })).toBeNull();
  expect(planner.ingest('A new thing', { revision: 0, history: state.history, selectedIds: [], manipulating: true, now: 3000 })).toBeNull();
});
it('lays out a simple tree with a root and separate children', () => {
  const intent = parseCommand('AirBoard, create a tree with System, API and Database');
  expect(intent?.kind).toBe('diagram');
  if (!intent || intent.kind !== 'diagram') return;
  expect(intent.plan.layout).toBe('tree');
  expect(validDiagramPlan(intent.plan)).toBe(true);
  const nodes = composeDiagram(intent.plan, initialState().history).filter(object => object.type === 'rectangle');
  expect(nodes[0].y).toBeLessThan(nodes[1].y);
  expect(nodes[1].y).toBe(nodes[2].y);
  expect(nodes[1].x).toBeLessThan(nodes[2].x);
});
it('validates a plan and commits generated geometry atomically', () => {
  const intent = parseCommand('AirBoard, create a flowchart with data collection, model training and deployment');
  expect(intent?.kind).toBe('diagram');
  if (!intent || intent.kind !== 'diagram') return;
  expect(validDiagramPlan(intent.plan)).toBe(true);
  const state = initialState();
  const objects = composeDiagram(intent.plan, state.history);
  expect(objects.filter(object => object.type === 'rectangle')).toHaveLength(3);
  expect(objects.filter(object => object.type === 'connector')).toHaveLength(2);
  expect(validCommand({ type: 'create-diagram', objects, requestId: 'r1', baseRevision: 0 })).toBe(true);
  reduce(state, { type: 'create-diagram', objects, requestId: 'r1', baseRevision: 0 });
  expect(state.history.position).toBe(1);
  reduce(state, { type: 'undo' }); expect(state.history.position).toBe(0);
  expect(validDiagramPlan({ ...intent.plan, nodes: [{ id: 'a', type: 'image', label: '<script>' }], edges: [] })).toBe(false);
  expect(validDiagramPlan({ ...intent.plan, edges: [{ from: 'missing', to: 'api' }] })).toBe(false);
});
