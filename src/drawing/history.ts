import type { Brush, HistoryState, Point, Stroke } from '../core/types';
export const MAX_POINTS = 12000;
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
export function clear(history: HistoryState): void {
  finishStroke(history);
  history.actions.splice(history.position);
  history.actions.push({ kind: 'clear' });
  history.position = history.actions.length;
}
export interface MovePreview { ids: string[]; dx: number; dy: number }
const translated = (stroke: Stroke, dx: number, dy: number): Stroke => ({ ...stroke, brush: { ...stroke.brush }, points: stroke.points.map(point => ({ x: point.x + dx, y: point.y + dy })) });
export function moveStrokes(history: HistoryState, ids: string[], dx: number, dy: number): void {
  finishStroke(history);
  const unique = [...new Set(ids)];
  if (!unique.length || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 0.5) return;
  history.actions.splice(history.position);
  history.actions.push({ kind: 'move', ids: unique, dx, dy });
  history.position = history.actions.length;
}
export function currentStrokes(history: HistoryState, preview: MovePreview | null = null): Stroke[] {
  let strokes: Stroke[] = [];
  for (const action of history.actions.slice(0, history.position)) {
    if (action.kind === 'clear') strokes = [];
    else if (action.kind === 'stroke') strokes.push(translated(action.stroke, 0, 0));
    else strokes = strokes.map(stroke => action.ids.includes(stroke.id) ? translated(stroke, action.dx, action.dy) : stroke);
  }
  if (history.active) strokes.push(translated(history.active, 0, 0));
  if (preview) strokes = strokes.map(stroke => preview.ids.includes(stroke.id) ? translated(stroke, preview.dx, preview.dy) : stroke);
  return strokes;
}
