import { BOARD, type BoardObject, type Point } from '../core/types';

export const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
export const objectCenter = (object: BoardObject): Point => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 });
export function rotatePoint(point: Point, pivot: Point, radians: number): Point {
  if (!radians) return { ...point };
  const cosine = Math.cos(radians), sine = Math.sin(radians), x = point.x - pivot.x, y = point.y - pivot.y;
  return { x: pivot.x + x * cosine - y * sine, y: pivot.y + x * sine + y * cosine };
}
export const normalizeAngle = (radians: number): number => Math.atan2(Math.sin(radians), Math.cos(radians));
export function unwrapAngle(previous: number, next: number): number {
  let value = next;
  while (value - previous > Math.PI) value -= Math.PI * 2;
  while (value - previous < -Math.PI) value += Math.PI * 2;
  return value;
}
export const worldPoint = (object: BoardObject, point: Point): Point => rotatePoint(point, objectCenter(object), object.rotation ?? 0);
export const localPoint = (object: BoardObject, point: Point): Point => rotatePoint(point, objectCenter(object), -(object.rotation ?? 0));

export function pointBounds(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

export function selectionCenter(objects: BoardObject[]): Point {
  const points = objects.flatMap(object => {
    const center = objectCenter(object), angle = object.rotation ?? 0;
    return [rotatePoint({ x: object.x, y: object.y }, center, angle), rotatePoint({ x: object.x + object.width, y: object.y }, center, angle), rotatePoint({ x: object.x + object.width, y: object.y + object.height }, center, angle), rotatePoint({ x: object.x, y: object.y + object.height }, center, angle)];
  });
  const box = pointBounds(points);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function cloneObject(object: BoardObject): BoardObject {
  return { ...object, vertices: object.vertices?.map(point => ({ ...point })) };
}

/** Applies one immutable group transform around a shared pivot. Returns null when any result leaves the board. */
export function transformSelection(objects: BoardObject[], scale: number, rotation: number, pivot = selectionCenter(objects)): BoardObject[] | null {
  if (!objects.length || !Number.isFinite(scale) || scale < .2 || scale > 4 || !Number.isFinite(rotation)) return null;
  const results = objects.map(source => {
    const object = cloneObject(source), center = objectCenter(source);
    const scaledCenter = { x: pivot.x + (center.x - pivot.x) * scale, y: pivot.y + (center.y - pivot.y) * scale };
    const nextCenter = rotatePoint(scaledCenter, pivot, rotation);
    const width = source.width * scale, height = source.height * scale;
    object.x = nextCenter.x - width / 2; object.y = nextCenter.y - height / 2; object.width = width; object.height = height;
    object.rotation = normalizeAngle((source.rotation ?? 0) + rotation);
    if (source.vertices) object.vertices = source.vertices.map(point => ({ x: nextCenter.x + (point.x - center.x) * scale, y: nextCenter.y + (point.y - center.y) * scale }));
    return object;
  });
  const corners = results.flatMap(object => {
    const center = objectCenter(object), radians = object.rotation ?? 0;
    return [
      rotatePoint({ x: object.x, y: object.y }, center, radians), rotatePoint({ x: object.x + object.width, y: object.y }, center, radians),
      rotatePoint({ x: object.x + object.width, y: object.y + object.height }, center, radians), rotatePoint({ x: object.x, y: object.y + object.height }, center, radians),
    ];
  });
  if (corners.some(point => point.x < 0 || point.x > BOARD.width || point.y < 0 || point.y > BOARD.height)) return null;
  return results;
}

export function translatedObject(object: BoardObject, dx: number, dy: number): BoardObject {
  return { ...object, x: object.x + dx, y: object.y + dy, vertices: object.vertices?.map(point => ({ x: point.x + dx, y: point.y + dy })) };
}
