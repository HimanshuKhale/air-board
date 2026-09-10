import type { BoardState, Brush, Point, Settings } from '../core/types';
import { appendPoint, beginStroke, clear, finishStroke, redo, undo } from '../drawing/history';
export type Command =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'begin'; id: string; brush: Brush; point: Point }
  | { type: 'point'; id: string; point: Point }
  | { type: 'end'; id: string }
  | { type: 'undo' | 'redo' | 'clear' };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const range = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const point = (v: unknown): v is Point => object(v) && range(v.x, 0, 1600) && range(v.y, 0, 900);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 100;
export function validBrush(v: unknown): v is Brush {
  return object(v) && ['pen', 'highlighter', 'eraser'].includes(String(v.tool)) && color(v.color) && range(v.size, 1, 100) && range(v.opacity, 0.05, 1);
}
export function validSettingsPatch(v: unknown): v is Partial<Settings> {
  if (!object(v)) return false;
  return Object.entries(v).every(([key, value]) => {
    switch (key) {
      case 'brush': return validBrush(value);
      case 'background': return object(value) && ['blank', 'camera', 'image'].includes(String(value.mode)) && color(value.color) &&
        (value.image === null || (typeof value.image === 'string' && value.image.length <= 16_000_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image))) &&
        ['contain', 'cover', 'stretch'].includes(String(value.fit)) && typeof value.mirror === 'boolean' && range(value.dim, 0, 0.8) && range(value.positionX, 0, 1) && range(value.positionY, 0, 1);
      case 'smoothing': return range(value, 0.1, 1);
      case 'pinchClose': return range(value, 0.1, 0.38);
      case 'pinchOpen': return range(value, 0.4, 0.8);
      case 'debounceMs': return range(value, 30, 200);
      case 'paused': case 'autoHide': return typeof value === 'boolean';
      default: return false;
    }
  });
}
export function validCommand(v: unknown): v is Command {
  if (!object(v)) return false;
  switch (v.type) {
    case 'settings': return validSettingsPatch(v.patch);
    case 'begin': return id(v.id) && validBrush(v.brush) && point(v.point);
    case 'point': return id(v.id) && point(v.point);
    case 'end': return id(v.id);
    case 'undo': case 'redo': case 'clear': return true;
    default: return false;
  }
}
export function validState(v: unknown): v is BoardState {
  if (!object(v) || !object(v.settings) || !validSettingsPatch(v.settings) || Object.keys(v.settings).length !== 8 || !object(v.history)) return false;
  const h = v.history;
  const stroke = (s: unknown) => object(s) && id(s.id) && validBrush(s.brush) && Array.isArray(s.points) && s.points.length > 0 && s.points.length <= 12000 && s.points.every(point);
  return Array.isArray(h.actions) && h.actions.every(a => object(a) && (a.kind === 'clear' || (a.kind === 'stroke' && stroke(a.stroke)))) &&
    Number.isInteger(h.position) && range(h.position, 0, h.actions.length) && (h.active === null || stroke(h.active));
}
export function reduce(state: BoardState, command: Command): void {
  switch (command.type) {
    case 'settings':
      finishStroke(state.history);
      Object.assign(state.settings, command.patch);
      break;
    case 'begin': beginStroke(state.history, command.id, command.brush, command.point); break;
    case 'point': appendPoint(state.history, command.id, command.point); break;
    case 'end': finishStroke(state.history, command.id); break;
    case 'undo': undo(state.history); break;
    case 'redo': redo(state.history); break;
    case 'clear': clear(state.history); break;
  }
}
