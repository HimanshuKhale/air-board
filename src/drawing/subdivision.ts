import type { BoardObject, Point } from '../core/types';
import { signedArea, validPolygon, vertexBounds } from './geometry';
import { objectOutline } from './objects';
import { normalizeAngle, objectCenter, rotatePoint } from './spatial';

export type SubdivisionMethod = 'equal-length' | 'equal-area' | 'similar';
export interface SubdivisionResult { pieces: BoardObject[]; method: SubdivisionMethod }
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const cloneStyle = (source: BoardObject, id: string): BoardObject => ({ id, type: source.type, x: source.x, y: source.y, width: source.width, height: source.height, color: source.color, strokeWidth: source.strokeWidth, text: source.text });

function lineObject(source: BoardObject, id: string, a: Point, b: Point, type: 'line' | 'arrow'): BoardObject {
  return { ...cloneStyle(source, id), type, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)), flipY: (b.x - a.x) * (b.y - a.y) < 0, rotation: 0, text: '' };
}
function polygonObject(source: BoardObject, id: string, vertices: Point[]): BoardObject {
  const bounds = vertexBounds(vertices);
  return { ...cloneStyle(source, id), ...bounds, type: vertices.length === 3 ? 'triangle' : 'polygon', vertices: vertices.map(point => ({ ...point })), regular: false, rotation: 0, text: '' };
}
function convex(vertices: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], c = vertices[(i + 2) % vertices.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-7) continue;
    const next = Math.sign(cross); if (sign && next !== sign) return false; sign = next;
  }
  return sign !== 0;
}
function clip(vertices: Point[], axis: 'x' | 'y', threshold: number, keepBelow: boolean): Point[] {
  const result: Point[] = [], inside = (point: Point) => keepBelow ? point[axis] <= threshold + 1e-8 : point[axis] >= threshold - 1e-8;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], aInside = inside(a), bInside = inside(b);
    if (aInside) result.push({ ...a });
    if (aInside !== bInside) {
      const delta = b[axis] - a[axis]; if (Math.abs(delta) < 1e-9) continue;
      result.push(lerp(a, b, (threshold - a[axis]) / delta));
    }
  }
  return result;
}
const area = (vertices: Point[]) => Math.abs(signedArea(vertices));

/** Convex polygons are clipped into parallel monotone slabs. Binary-searched cut positions give each slab 1/N of the source area. */
function convexEqualArea(source: BoardObject, vertices: Point[], count: number, idFactory: () => string): BoardObject[] | null {
  const xs = vertices.map(point => point.x), ys = vertices.map(point => point.y);
  const axis: 'x' | 'y' = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 'x' : 'y';
  const low = Math.min(...vertices.map(point => point[axis])), high = Math.max(...vertices.map(point => point[axis])), total = area(vertices);
  const cuts: number[] = [low - 1];
  for (let index = 1; index < count; index++) {
    const target = total * index / count; let left = low, right = high;
    for (let step = 0; step < 60; step++) {
      const middle = (left + right) / 2, candidate = clip(vertices, axis, middle, true);
      if (area(candidate) < target) left = middle; else right = middle;
    }
    cuts.push((left + right) / 2);
  }
  cuts.push(high + 1);
  const polygons = Array.from({ length: count }, (_, index) => clip(clip(vertices, axis, cuts[index + 1], true), axis, cuts[index], false));
  if (polygons.some(points => !validPolygon(points) || Math.abs(area(points) - total / count) > Math.max(1, total * 1e-5))) return null;
  return polygons.map(points => polygonObject(source, idFactory(), points));
}

function rectangleStrips(source: BoardObject, count: number, idFactory: () => string): BoardObject[] {
  const horizontal = source.width >= source.height, center = objectCenter(source), rotation = source.rotation ?? 0;
  return Array.from({ length: count }, (_, index) => {
    const width = horizontal ? source.width / count : source.width, height = horizontal ? source.height : source.height / count;
    const localCenter = horizontal
      ? { x: source.x + width * (index + .5), y: center.y }
      : { x: center.x, y: source.y + height * (index + .5) };
    const worldCenter = rotatePoint(localCenter, center, rotation);
    return { ...cloneStyle(source, idFactory()), type: Math.abs(width - height) <= 1 ? 'square' : 'rectangle', x: worldCenter.x - width / 2, y: worldCenter.y - height / 2, width, height, rotation: normalizeAngle(rotation), text: '' };
  });
}
function isBoxGeometry(source: BoardObject): boolean {
  if (!source.vertices) return true;
  if (source.vertices.length !== 4) return false;
  return source.vertices.every(point => (Math.abs(point.x - source.x) < .01 || Math.abs(point.x - source.x - source.width) < .01) && (Math.abs(point.y - source.y) < .01 || Math.abs(point.y - source.y - source.height) < .01));
}

export function subdivide(source: BoardObject, count: number, mode: 'equal-area' | 'similar' = 'equal-area', idFactory: () => string = () => crypto.randomUUID()): SubdivisionResult | null {
  if (!Number.isInteger(count) || count < 2 || count > 12 || source.type === 'text' || source.type === 'connector' || source.type === 'circle' || source.type === 'ellipse') return null;
  if (source.type === 'line' || source.type === 'arrow') {
    const [start, end] = objectOutline(source), pieces = Array.from({ length: count }, (_, index) => lineObject(source, idFactory(), lerp(start, end, index / count), lerp(start, end, (index + 1) / count), source.type === 'arrow' && index === count - 1 ? 'arrow' : 'line'));
    return { pieces, method: 'equal-length' };
  }
  if (['square', 'rectangle'].includes(source.type) && isBoxGeometry(source)) return { pieces: rectangleStrips(source, count, idFactory), method: 'equal-area' };
  const vertices = objectOutline(source);
  if (!validPolygon(vertices) || !convex(vertices)) return null;
  if (source.type === 'triangle' && mode === 'similar') {
    if (count !== 4) return null;
    const [a, b, c] = vertices, ab = lerp(a, b, .5), bc = lerp(b, c, .5), ca = lerp(c, a, .5);
    return { pieces: [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]].map(points => polygonObject(source, idFactory(), points)), method: 'similar' };
  }
  if (source.type === 'triangle') {
    const [opposite, edgeA, edgeB] = vertices;
    return { pieces: Array.from({ length: count }, (_, index) => polygonObject(source, idFactory(), [opposite, lerp(edgeA, edgeB, index / count), lerp(edgeA, edgeB, (index + 1) / count)])), method: 'equal-area' };
  }
  const pieces = convexEqualArea(source, vertices, count, idFactory);
  return pieces ? { pieces, method: 'equal-area' } : null;
}
