import type { BoardState, Brush, Point, Settings } from '../core/types';
import { appendPoint, beginStroke, clear, finishStroke, moveStrokes, redo, undo } from '../drawing/history';
import { homographyFromQuad } from '../calibration/homography';
export type Command =
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'begin'; id: string; brush: Brush; point: Point }
  | { type: 'point'; id: string; point: Point }
  | { type: 'end'; id: string }
  | { type: 'select'; ids: string[] }
  | { type: 'move'; ids: string[]; dx: number; dy: number }
  | { type: 'undo' | 'redo' | 'clear' };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const range = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const point = (v: unknown): v is Point => object(v) && range(v.x, 0, 1600) && range(v.y, 0, 900);
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 100;
const planePoints = (v: unknown): v is Point[] | null => {
  if (v === null) return true;
  if (!Array.isArray(v) || v.length !== 4 || !v.every(p => object(p) && range(p.x, -1, 2) && range(p.y, -1, 2))) return false;
  try { homographyFromQuad(v as Point[]); return true; } catch { return false; }
};
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
      case 'dominantHand': return value === 'Left' || value === 'Right';
      case 'gestureSensitivity': return value === 'gentle' || value === 'balanced' || value === 'responsive';
      case 'inputMode': return value === 'finger' || value === 'stylus';
      case 'stylusOffset': return object(value) && range(value.x, -1, 1) && range(value.y, -1, 1);
      case 'openPalmHoldMs': return range(value, 150, 250);
      case 'palmEraserSize': return range(value, 30, 160);
      case 'planePoints': return planePoints(value);
      case 'lassoCloseRadius': return range(value, 25, 120);
      case 'fistGrabRadius': return range(value, 25, 160);
      case 'twoHandHoldMs': return range(value, 400, 600);
      case 'twoHandProximity': return range(value, 0.08, 0.5);
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
    case 'select': return Array.isArray(v.ids) && v.ids.length <= 1000 && v.ids.every(id);
    case 'move': return Array.isArray(v.ids) && v.ids.length > 0 && v.ids.length <= 1000 && v.ids.every(id) && range(v.dx, -3200, 3200) && range(v.dy, -1800, 1800);
    case 'undo': case 'redo': case 'clear': return true;
    default: return false;
  }
}
export function validState(v: unknown): v is BoardState {
  const requiredSettings = ['brush', 'background', 'smoothing', 'pinchClose', 'pinchOpen', 'debounceMs', 'paused', 'autoHide', 'dominantHand', 'gestureSensitivity', 'inputMode', 'stylusOffset', 'openPalmHoldMs', 'palmEraserSize', 'planePoints', 'lassoCloseRadius', 'fistGrabRadius', 'twoHandHoldMs', 'twoHandProximity'];
  if (!object(v) || !object(v.settings) || !validSettingsPatch(v.settings) || !requiredSettings.every(key => Object.hasOwn(v.settings as object, key)) || !object(v.history) || !Array.isArray(v.selection) || !v.selection.every(id)) return false;
  const h = v.history;
  const stroke = (s: unknown) => object(s) && id(s.id) && validBrush(s.brush) && Array.isArray(s.points) && s.points.length > 0 && s.points.length <= 12000 && s.points.every(point);
  return Array.isArray(h.actions) && h.actions.every(a => object(a) && (a.kind === 'clear' || (a.kind === 'stroke' && stroke(a.stroke)) || (a.kind === 'move' && Array.isArray(a.ids) && a.ids.length > 0 && a.ids.every(id) && range(a.dx, -3200, 3200) && range(a.dy, -1800, 1800)))) &&
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
    case 'select': state.selection = [...new Set(command.ids)]; break;
    case 'move': moveStrokes(state.history, command.ids, command.dx, command.dy); state.selection = [...new Set(command.ids)]; break;
    case 'undo': undo(state.history); state.selection = []; break;
    case 'redo': redo(state.history); state.selection = []; break;
    case 'clear': clear(state.history); state.selection = []; break;
  }
}
