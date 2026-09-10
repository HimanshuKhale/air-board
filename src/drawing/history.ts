import type { Brush, HistoryState, Point } from '../core/types';
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
