import { BOARD, type BoardObject, type Brush, type DrawAction, type HistoryState, type Point, type Stroke } from '../core/types';
import { attachedConnector } from './objects';
export const MAX_POINTS = 12000;
export interface MovePreview { ids: string[]; dx: number; dy: number }
export interface Scene { strokes: Stroke[]; objects: BoardObject[] }
const translatedStroke = (stroke: Stroke, dx: number, dy: number): Stroke => ({ ...stroke, brush: { ...stroke.brush }, points: stroke.points.map(point => ({ x: point.x + dx, y: point.y + dy })) });
const translatedObject = (object: BoardObject, dx: number, dy: number): BoardObject => ({ ...object, x: object.x + dx, y: object.y + dy, vertices: object.vertices?.map(point => ({ x: point.x + dx, y: point.y + dy })) });
function commit(history: HistoryState, action: DrawAction): void {
  finishStroke(history);
  history.actions.splice(history.position);
  history.actions.push(action);
  history.position = history.actions.length;
}
export function beginStroke(history: HistoryState, id: string, brush: Brush, point: Point): void {
  if (history.active) return;
  history.active = { id, brush: { ...brush }, points: [{ ...point }] };
}
export function appendPoint(history: HistoryState, id: string, point: Point): void {
  const active = history.active;
  if (!active || active.id !== id || active.points.length >= MAX_POINTS) return;
  const previous = active.points.at(-1)!;
  if (Math.hypot(previous.x - point.x, previous.y - point.y) >= 0.3) active.points.push({ ...point });
}
export function finishStroke(history: HistoryState, id?: string): void {
  if (!history.active || (id && history.active.id !== id)) return;
  history.actions.splice(history.position);
  history.actions.push({ kind: 'stroke', stroke: history.active });
  history.position = history.actions.length;
  history.active = null;
}
export function undo(history: HistoryState): void { finishStroke(history); history.position = Math.max(0, history.position - 1); }
export function redo(history: HistoryState): void { if (!history.active) history.position = Math.min(history.actions.length, history.position + 1); }
export function clear(history: HistoryState): void { commit(history, { kind: 'clear' }); }
export function moveStrokes(history: HistoryState, ids: string[], dx: number, dy: number): void {
  const unique = [...new Set(ids)];
  if (!unique.length || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 0.5) return;
  const objects = currentScene(history).objects.filter(object => unique.includes(object.id));
  if (objects.length) {
    dx = Math.max(-Math.min(...objects.map(object => object.x)), Math.min(BOARD.width - Math.max(...objects.map(object => object.x + object.width)), dx));
    dy = Math.max(-Math.min(...objects.map(object => object.y)), Math.min(BOARD.height - Math.max(...objects.map(object => object.y + object.height)), dy));
  }
  if (Math.hypot(dx, dy) < 0.5) return;
  commit(history, { kind: 'move', ids: unique, dx, dy });
}
export function createObject(history: HistoryState, object: BoardObject): boolean {
  const objects = currentScene(history).objects;
  if (objects.some(item => item.id === object.id) || object.fromId && (!objects.some(item => item.id === object.fromId) || !objects.some(item => item.id === object.toId))) return false;
  commit(history, { kind: 'create', object }); return true;
}
export function updateObject(history: HistoryState, object: BoardObject): boolean {
  if (!currentScene(history).objects.some(item => item.id === object.id)) return false;
  commit(history, { kind: 'update', object }); return true;
}
export function deleteObject(history: HistoryState, id: string): boolean {
  if (!currentScene(history).objects.some(item => item.id === id)) return false;
  commit(history, { kind: 'delete', id }); return true;
}
export function replaceStroke(history: HistoryState, strokeId: string, object: BoardObject): boolean {
  const scene = currentScene(history);
  if (!scene.strokes.some(item => item.id === strokeId && item.brush.tool !== 'eraser') || scene.objects.some(item => item.id === object.id)) return false;
  commit(history, { kind: 'replace', strokeId, object }); return true;
}
export function replaceStrokes(history: HistoryState, strokeIds: string[], object: BoardObject): boolean {
  const unique = [...new Set(strokeIds)], scene = currentScene(history);
  if (!unique.length || unique.some(id => !scene.strokes.some(item => item.id === id && item.brush.tool !== 'eraser')) || scene.objects.some(item => item.id === object.id)) return false;
  commit(history, { kind: 'replace-many', strokeIds: unique, object }); return true;
}
export function createDiagram(history: HistoryState, objects: BoardObject[]): boolean {
  const ids = new Set(currentScene(history).objects.map(item => item.id));
  if (!objects.length || objects.some(item => ids.has(item.id) || (ids.add(item.id), false))) return false;
  if (objects.some(item => item.fromId && (!ids.has(item.fromId) || !ids.has(item.toId!)))) return false;
  commit(history, { kind: 'diagram', objects }); return true;
}
/** Replays the single history timeline, so old stroke-only snapshots remain valid. */
export function currentScene(history: HistoryState, preview: MovePreview | null = null): Scene {
  let strokes: Stroke[] = [], objects: BoardObject[] = [];
  for (const action of history.actions.slice(0, history.position)) {
    switch (action.kind) {
      case 'clear': strokes = []; objects = []; break;
      case 'stroke': strokes.push(translatedStroke(action.stroke, 0, 0)); break;
      case 'move':
        strokes = strokes.map(stroke => action.ids.includes(stroke.id) ? translatedStroke(stroke, action.dx, action.dy) : stroke);
        objects = objects.map(object => {
          if (!action.ids.includes(object.id)) return object;
          const moved = translatedObject(object, action.dx, action.dy);
          return object.type === 'connector' && object.fromId && !action.ids.includes(object.fromId) && !action.ids.includes(object.toId!) ? { ...moved, fromId: undefined, toId: undefined } : moved;
        }); break;
      case 'create': objects.push({ ...action.object }); break;
      case 'update': objects = objects.map(object => object.id === action.object.id ? { ...action.object } : object); break;
      case 'delete': objects = objects.filter(object => object.id !== action.id); break;
      case 'replace': strokes = strokes.filter(stroke => stroke.id !== action.strokeId); objects.push({ ...action.object }); break;
      case 'replace-many': strokes = strokes.filter(stroke => !action.strokeIds.includes(stroke.id)); objects.push({ ...action.object }); break;
      case 'diagram': objects.push(...action.objects.map(object => ({ ...object }))); break;
    }
  }
  if (history.active) strokes.push(translatedStroke(history.active, 0, 0));
  if (preview) {
    strokes = strokes.map(stroke => preview.ids.includes(stroke.id) ? translatedStroke(stroke, preview.dx, preview.dy) : stroke);
    objects = objects.map(object => preview.ids.includes(object.id) ? translatedObject(object, preview.dx, preview.dy) : object);
  }
  const byId = new Map(objects.map(object => [object.id, object]));
  objects = objects.filter(object => !object.fromId || (byId.has(object.fromId) && byId.has(object.toId!)))
    .map(object => object.fromId ? attachedConnector(object, byId.get(object.fromId)!, byId.get(object.toId!)!) : object);
  return { strokes, objects };
}
export function currentStrokes(history: HistoryState, preview: MovePreview | null = null): Stroke[] { return currentScene(history, preview).strokes; }
export function currentObjects(history: HistoryState, preview: MovePreview | null = null): BoardObject[] { return currentScene(history, preview).objects; }
