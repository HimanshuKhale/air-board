import { BOARD, type BoardObject, type Point, type ShapeKind } from '../core/types';

export const polygonTypes = new Set<ShapeKind>(['triangle', 'square', 'rectangle', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'polygon']);
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export function vertexBounds(vertices: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = vertices.map(point => point.x), ys = vertices.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}
export function signedArea(vertices: Point[]): number {
  return vertices.reduce((sum, point, i) => { const next = vertices[(i + 1) % vertices.length]; return sum + point.x * next.y - next.x * point.y; }, 0) / 2;
}
const orientation = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}
export function validPolygon(vertices: Point[]): boolean {
  if (vertices.length < 3 || vertices.length > 32 || vertices.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > BOARD.width || point.y < 0 || point.y > BOARD.height) || Math.abs(signedArea(vertices)) < 100) return false;
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) {
    if (j === i || j === (i + 1) % vertices.length || i === (j + 1) % vertices.length) continue;
    if (segmentsCross(vertices[i], vertices[(i + 1) % vertices.length], vertices[j], vertices[(j + 1) % vertices.length])) return false;
  }
  return true;
}
export function regularVertices(sides: number, x: number, y: number, width: number, height: number, rotation = -Math.PI / 2): Point[] {
  return Array.from({ length: sides }, (_, i) => ({ x: x + width / 2 + Math.cos(rotation + i * Math.PI * 2 / sides) * width / 2, y: y + height / 2 + Math.sin(rotation + i * Math.PI * 2 / sides) * height / 2 }));
}
export function defaultVertices(type: ShapeKind, x: number, y: number, width: number, height: number): Point[] | undefined {
  switch (type) {
    case 'triangle': return [{ x: x + width / 2, y }, { x: x + width, y: y + height }, { x, y: y + height }];
    case 'square': case 'rectangle': return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
    case 'parallelogram': return [{ x: x + width * .2, y }, { x: x + width, y }, { x: x + width * .8, y: y + height }, { x, y: y + height }];
    case 'trapezoid': return [{ x: x + width * .2, y }, { x: x + width * .8, y }, { x: x + width, y: y + height }, { x, y: y + height }];
    case 'pentagon': return regularVertices(5, x, y, width, height);
    case 'hexagon': return regularVertices(6, x, y, width, height, 0);
    case 'polygon': return regularVertices(7, x, y, width, height);
    default: return undefined;
  }
}
export function withVertices(object: BoardObject, vertices: Point[], regular = false): BoardObject | null {
  if (!validPolygon(vertices)) return null;
  return { ...object, ...vertexBounds(vertices), vertices: vertices.map(point => ({ ...point })), regular };
}
export function makeShape(type: ShapeKind, id: string, x: number, y: number, width: number, height: number, color: string, strokeWidth: number): BoardObject {
  if (type === 'square' || type === 'circle') width = height = Math.min(width, height);
  const object: BoardObject = { id, type, x, y, width, height, color, strokeWidth, text: '' };
  const vertices = defaultVertices(type, x, y, width, height);
  return vertices ? { ...object, ...vertexBounds(vertices), vertices, regular: ['square', 'pentagon', 'hexagon', 'polygon'].includes(type) } : object;
}
