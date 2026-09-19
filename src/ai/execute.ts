import type { BoardObject } from '../core/types';
import { BOARD } from '../core/types';
import { currentObjects } from '../drawing/history';
import type { BoardChannel } from '../sync/channel';
import { composeDiagram } from './plan';
import type { Intent } from './commands';

function matches(target: string, object: BoardObject): boolean {
  const name = target.replace(/^(the|this|ye|is)\s+/, '').trim();
  return object.text.toLowerCase() === name || object.text.toLowerCase().includes(name) && name.length >= 3 || object.type === ({ box: 'rectangle', arrow: 'arrow', circle: 'ellipse' } as Record<string, string>)[name] || object.type === name;
}
function resolve(bus: BoardChannel, target: string): BoardObject {
  const objects = currentObjects(bus.state.history);
  const selected = objects.filter(object => bus.state.selection.includes(object.id));
  if (['selected', 'this', 'this box', 'ye', 'ye arrow', 'is box', 'box', 'arrow', 'shape', 'object'].includes(target) && selected.length === 1) return selected[0];
  const candidates = objects.filter(object => matches(target, object));
  if (candidates.length !== 1) throw new Error(candidates.length ? `Several objects match “${target}”. Select one first.` : `No object matches “${target}”.`);
  return candidates[0];
}
function connector(from: BoardObject, to: BoardObject, color: string): BoardObject {
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 }, b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  if (horizontal) { a.x += b.x > a.x ? from.width / 2 : -from.width / 2; b.x += b.x > a.x ? -to.width / 2 : to.width / 2; }
  else { a.y += b.y > a.y ? from.height / 2 : -from.height / 2; b.y += b.y > a.y ? -to.height / 2 : to.height / 2; }
  return { id: crypto.randomUUID(), type: 'connector', fromId: from.id, toId: to.id, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(a.x - b.x)), height: Math.max(1, Math.abs(a.y - b.y)), flipY: (b.x - a.x) * (b.y - a.y) < 0, color, strokeWidth: 4, text: '' };
}
/** Applies only validated board commands. Caller de-duplicates finalized transcript IDs. */
export function executeIntent(bus: BoardChannel, intent: Intent, requestId: string, confirmClear: () => boolean): string {
  const color = bus.state.settings.brush.color;
  const send = (command: Parameters<BoardChannel['send']>[0]) => bus.send(command, requestId);
  if (bus.state.history.active) throw new Error('Finish the current stroke before using a voice command.');
  switch (intent.kind) {
    case 'undo': send({ type: 'undo' }); return 'Undid last action.';
    case 'redo': send({ type: 'redo' }); return 'Redid last action.';
    case 'clear': if (!confirmClear()) return 'Clear cancelled.'; send({ type: 'clear' }); return 'Board cleared.';
    case 'delete': {
      if (bus.state.selection.length !== 1) throw new Error('Select one object to delete.');
      send({ type: 'delete-object', id: bus.state.selection[0] }); return 'Deleted selected object.';
    }
    case 'diagram': {
      const objects = composeDiagram(intent.plan, bus.state.history, color);
      send({ type: 'create-diagram', objects, requestId, baseRevision: bus.currentRevision }); return `Created ${intent.plan.nodes.length} connected boxes.`;
    }
    case 'create': {
      const labels = Array.from({ length: intent.count }, (_, i) => intent.count === 1 ? 'Shape' : `Shape ${i + 1}`);
      const nodes = labels.map((label, i) => ({ id: `node_${i}`, type: intent.type === 'ellipse' || intent.type === 'triangle' ? intent.type : 'rectangle' as const, label }));
      const plan = { version: 1 as const, operation: 'create_diagram' as const, layout: 'horizontal' as const, nodes, edges: [] };
      const objects = composeDiagram(plan, bus.state.history, color).map(object => ({ ...object, type: intent.type, text: '' }));
      send({ type: 'create-diagram', objects, requestId, baseRevision: bus.currentRevision }); return `Created ${intent.count} ${intent.type}${intent.count > 1 ? 's' : ''}.`;
    }
    case 'select': { const object = resolve(bus, intent.target); send({ type: 'select', ids: [object.id] }); return `Selected ${object.text || object.type}.`; }
    case 'label': { const object = resolve(bus, intent.target); send({ type: 'update-object', object: { ...object, text: intent.text.slice(0, 80) } }); return `Labeled ${object.type}.`; }
    case 'recolor': { const object = resolve(bus, intent.target); send({ type: 'update-object', object: { ...object, color: intent.color } }); return 'Color updated.'; }
    case 'move': {
      const object = resolve(bus, intent.target), offsets = { up: [0, -80], down: [0, 80], left: [-80, 0], right: [80, 0] } as const;
      const [dx, dy] = offsets[intent.direction];
      if (object.x + dx < 0 || object.x + object.width + dx > BOARD.width || object.y + dy < 0 || object.y + object.height + dy > BOARD.height) throw new Error('Move would leave the board.');
      send({ type: 'move', ids: [object.id], dx, dy }); return 'Object moved.';
    }
    case 'resize': {
      const object = resolve(bus, intent.target), width = Math.round(object.width * intent.factor), height = Math.round(object.height * intent.factor);
      if (width < 20 || height < 20 || object.x + width > BOARD.width || object.y + height > BOARD.height) throw new Error('Resize would leave the board.');
      send({ type: 'update-object', object: { ...object, width, height } }); return 'Object resized.';
    }
    case 'connect': {
      const from = resolve(bus, intent.from), to = resolve(bus, intent.to);
      if (from.id === to.id) throw new Error('Choose two different objects.');
      send({ type: 'create-object', object: connector(from, to, color) }); return 'Objects connected.';
    }
    case 'add-below': {
      const anchor = resolve(bus, intent.anchor), y = anchor.y + anchor.height + 80;
      if (y + 90 > BOARD.height) throw new Error('No room below the selected object.');
      const node: BoardObject = { id: crypto.randomUUID(), type: 'rectangle', x: anchor.x, y, width: Math.max(anchor.width, Math.min(250, intent.label.length * 12 + 36)), height: 90, color, strokeWidth: 5, text: intent.label.slice(0, 80) };
      if (node.x + node.width > BOARD.width) throw new Error('No room below the selected object.');
      send({ type: 'create-diagram', objects: [connector(anchor, node, color), node], requestId, baseRevision: bus.currentRevision }); return `Added ${intent.label} below ${anchor.text || anchor.type}.`;
    }
  }
}
