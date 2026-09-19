import { BOARD, type BoardObject, type Point, type Settings } from '../core/types';
import { objectOutline } from './objects';
import { validPolygon, vertexBounds, withVertices } from './geometry';

export type HandleKind = 'move' | 'corner' | 'edge' | 'vertex' | 'segment' | 'endpoint' | 'radius';
export interface ShapeHandle { id: string; kind: HandleKind; point: Point; index?: number; axis?: 'x' | 'y'; side?: 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'se' | 'sw' }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const point = (x: number, y: number): Point => ({ x, y });
const isLine = (object: BoardObject) => ['line', 'arrow'].includes(object.type);

export function shapeHandles(object: BoardObject, editMode: Settings['shapeEditMode'], resizeMode: Settings['shapeResizeMode']): ShapeHandle[] {
  const { x, y, width: w, height: h } = object;
  if (isLine(object)) return objectOutline(object).slice(0, 2).map((p, index) => ({ id: `endpoint-${index}`, kind: 'endpoint', point: p, index }));
  if (object.type === 'circle' || object.type === 'ellipse') return [
    { id: 'radius-w', kind: 'radius', point: point(x, y + h / 2), side: 'w', axis: 'x' },
    { id: 'radius-e', kind: 'radius', point: point(x + w, y + h / 2), side: 'e', axis: 'x' },
    { id: 'radius-n', kind: 'radius', point: point(x + w / 2, y), side: 'n', axis: 'y' },
    { id: 'radius-s', kind: 'radius', point: point(x + w / 2, y + h), side: 's', axis: 'y' },
    { id: 'move', kind: 'move', point: point(x + w / 2, y + h / 2) },
  ];
  if (editMode === 'points' && object.vertices?.length) {
    const vertices = object.vertices;
    return [
      ...vertices.map((p, index) => ({ id: `vertex-${index}`, kind: 'vertex' as const, point: p, index })),
      ...vertices.map((p, index) => ({ id: `edge-${index}`, kind: 'segment' as const, point: midpoint(p, vertices[(index + 1) % vertices.length]), index })),
    ];
  }
  const handles: ShapeHandle[] = [
    { id: 'nw', kind: 'corner', point: point(x, y), side: 'nw' }, { id: 'ne', kind: 'corner', point: point(x + w, y), side: 'ne' },
    { id: 'se', kind: 'corner', point: point(x + w, y + h), side: 'se' }, { id: 'sw', kind: 'corner', point: point(x, y + h), side: 'sw' },
    { id: 'move', kind: 'move', point: point(x + w / 2, y + h / 2) },
  ];
  if (resizeMode === 'free') handles.push(
    { id: 'n', kind: 'edge', point: point(x + w / 2, y), side: 'n' }, { id: 'e', kind: 'edge', point: point(x + w, y + h / 2), side: 'e' },
    { id: 's', kind: 'edge', point: point(x + w / 2, y + h), side: 's' }, { id: 'w', kind: 'edge', point: point(x, y + h / 2), side: 'w' },
  );
  return handles;
}

export function nearestShapeHandle(handles: ShapeHandle[], target: Point, radius = 34): ShapeHandle | null {
  let best: ShapeHandle | null = null, bestDistance = radius;
  for (const handle of handles) {
    const d = Math.hypot(target.x - handle.point.x, target.y - handle.point.y);
    if (d <= bestDistance) { best = handle; bestDistance = d; }
  }
  return best;
}

function translated(object: BoardObject, target: Point): BoardObject {
  const dx = clamp(target.x - (object.x + object.width / 2), -object.x, BOARD.width - object.x - object.width);
  const dy = clamp(target.y - (object.y + object.height / 2), -object.y, BOARD.height - object.y - object.height);
  return { ...object, x: object.x + dx, y: object.y + dy, vertices: object.vertices?.map(p => point(p.x + dx, p.y + dy)) };
}

function fromEndpoints(object: BoardObject, endpoints: Point[]): BoardObject | null {
  if (Math.hypot(endpoints[1].x - endpoints[0].x, endpoints[1].y - endpoints[0].y) < 20) return null;
  const [a, b] = endpoints;
  return { ...object, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)), flipY: (b.x - a.x) * (b.y - a.y) < 0 };
}

function resizeBox(object: BoardObject, handle: ShapeHandle, target: Point, mode: Settings['shapeResizeMode']): BoardObject | null {
  const side = handle.side!;
  const x0 = object.x, x1 = object.x + object.width, y0 = object.y, y1 = object.y + object.height;
  let left = x0, right = x1, top = y0, bottom = y1;
  if (side.includes('w')) left = clamp(target.x, 0, right - 20);
  if (side.includes('e')) right = clamp(target.x, left + 20, BOARD.width);
  if (side.includes('n')) top = clamp(target.y, 0, bottom - 20);
  if (side.includes('s')) bottom = clamp(target.y, top + 20, BOARD.height);
  if (mode === 'proportional' && handle.kind === 'corner') {
    const anchor = point(side.includes('w') ? x1 : x0, side.includes('n') ? y1 : y0);
    const sx = Math.abs(target.x - anchor.x) / object.width, sy = Math.abs(target.y - anchor.y) / object.height;
    const scale = Math.max(20 / object.width, 20 / object.height, Math.min(sx, sy));
    const width = Math.min(object.width * scale, side.includes('w') ? anchor.x : BOARD.width - anchor.x);
    const height = Math.min(object.height * scale, side.includes('n') ? anchor.y : BOARD.height - anchor.y);
    left = side.includes('w') ? anchor.x - width : anchor.x; right = left + width;
    top = side.includes('n') ? anchor.y - height : anchor.y; bottom = top + height;
  }
  const width = right - left, height = bottom - top;
  let type = object.type;
  if (mode === 'free' && type === 'square' && Math.abs(width - height) > 1) type = 'rectangle';
  const resized = { ...object, type, x: left, y: top, width, height };
  if (!object.vertices?.length) return resized;
  const sx = width / object.width, sy = height / object.height;
  const vertices = object.vertices.map(p => point(left + (p.x - object.x) * sx, top + (p.y - object.y) * sy));
  return withVertices(resized, vertices, object.regular && mode === 'proportional');
}

function editVertices(object: BoardObject, handle: ShapeHandle, target: Point): BoardObject | null {
  if (!object.vertices?.length || handle.index === undefined) return null;
  const vertices = object.vertices.map(p => ({ ...p }));
  const i = handle.index, next = (i + 1) % vertices.length;
  if (handle.kind === 'vertex') vertices[i] = point(clamp(target.x, 0, BOARD.width), clamp(target.y, 0, BOARD.height));
  else {
    const start = vertices[i], end = vertices[next], middle = midpoint(start, end), dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length;
    const amount = (target.x - middle.x) * nx + (target.y - middle.y) * ny;
    vertices[i] = point(clamp(start.x + nx * amount, 0, BOARD.width), clamp(start.y + ny * amount, 0, BOARD.height));
    vertices[next] = point(clamp(end.x + nx * amount, 0, BOARD.width), clamp(end.y + ny * amount, 0, BOARD.height));
  }
  if (!validPolygon(vertices)) return null;
  let type = object.type;
  if (handle.kind === 'vertex' || !['square', 'rectangle'].includes(type)) type = 'polygon';
  else {
    const box = vertexBounds(vertices);
    type = type === 'square' && Math.abs(box.width - box.height) <= 1 ? 'square' : 'rectangle';
  }
  return { ...object, ...vertexBounds(vertices), type, vertices, regular: false };
}

function editRadius(object: BoardObject, handle: ShapeHandle, target: Point, mode: Settings['shapeResizeMode']): BoardObject | null {
  const cx = object.x + object.width / 2, cy = object.y + object.height / 2;
  const originalRx = object.width / 2, originalRy = object.height / 2;
  let rx = originalRx, ry = originalRy;
  if (mode === 'proportional') {
    const requested = handle.axis === 'x' ? Math.abs(target.x - cx) / originalRx : Math.abs(target.y - cy) / originalRy;
    const minimum = Math.max(10 / originalRx, 10 / originalRy);
    const maximum = Math.min(cx / originalRx, (BOARD.width - cx) / originalRx, cy / originalRy, (BOARD.height - cy) / originalRy);
    const scale = clamp(requested, minimum, maximum); rx = originalRx * scale; ry = originalRy * scale;
  } else if (handle.axis === 'x') {
    rx = Math.abs(target.x - cx);
  } else {
    ry = Math.abs(target.y - cy);
  }
  rx = Math.min(Math.max(10, rx), cx, BOARD.width - cx); ry = Math.min(Math.max(10, ry), cy, BOARD.height - cy);
  const type = object.type === 'circle' && Math.abs(rx - ry) > 1 ? 'ellipse' : object.type;
  return { ...object, type, x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
}

/** Applies a handle to an immutable baseline, avoiding cumulative preview drift. */
export function transformObject(object: BoardObject, handle: ShapeHandle, target: Point, mode: Settings['shapeResizeMode']): BoardObject | null {
  if (handle.kind === 'move') return translated(object, target);
  if (handle.kind === 'endpoint') {
    const endpoints = objectOutline(object).slice(0, 2);
    endpoints[handle.index ?? 0] = point(clamp(target.x, 0, BOARD.width), clamp(target.y, 0, BOARD.height));
    return fromEndpoints(object, endpoints);
  }
  if (handle.kind === 'radius') return editRadius(object, handle, target, mode);
  if (handle.kind === 'vertex' || handle.kind === 'segment') return editVertices(object, handle, target);
  return resizeBox(object, handle, target, mode);
}
