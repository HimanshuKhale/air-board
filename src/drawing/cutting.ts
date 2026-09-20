import type { BoardObject, CutLine, Point } from '../core/types';
import { signedArea, validPolygon, vertexBounds } from './geometry';
import { objectOutline } from './objects';

export interface CutResult { pieces: [BoardObject, BoardObject]; line: CutLine }
const EPSILON = 1e-6;
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const side = (line: CutLine, point: Point): number => cross(line.direction, subtract(point, line.point));
const area = (points: Point[]): number => Math.abs(signedArea(points));

function normalizedLine(line: CutLine): CutLine | null {
  if (![line.point.x, line.point.y, line.direction.x, line.direction.y].every(Number.isFinite)) return null;
  const length = Math.hypot(line.direction.x, line.direction.y);
  return length < EPSILON ? null : { point: { ...line.point }, direction: { x: line.direction.x / length, y: line.direction.y / length } };
}
function clean(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) if (!result.length || Math.hypot(point.x - result.at(-1)!.x, point.y - result.at(-1)!.y) > .01) result.push(point);
  if (result.length > 1 && Math.hypot(result[0].x - result.at(-1)!.x, result[0].y - result.at(-1)!.y) <= .01) result.pop();
  return result;
}
function clipHalfPlane(vertices: Point[], line: CutLine, keepPositive: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], sa = side(line, a), sb = side(line, b);
    const aInside = keepPositive ? sa >= -EPSILON : sa <= EPSILON;
    const bInside = keepPositive ? sb >= -EPSILON : sb <= EPSILON;
    if (aInside) result.push({ ...a });
    if (aInside !== bInside) result.push(lerp(a, b, sa / (sa - sb)));
  }
  return clean(result);
}
function convex(vertices: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], c = vertices[(i + 2) % vertices.length];
    const turn = cross(subtract(b, a), subtract(c, b));
    if (Math.abs(turn) < EPSILON) continue;
    if (sign && Math.sign(turn) !== sign) return false;
    sign = Math.sign(turn);
  }
  return sign !== 0;
}
function styled(source: BoardObject, id: string, vertices: Point[]): BoardObject {
  const box = vertexBounds(vertices);
  return { id, type: vertices.length === 3 ? 'triangle' : 'polygon', ...box, color: source.color, strokeWidth: source.strokeWidth, text: '', vertices: vertices.map(point => ({ ...point })), regular: false, rotation: 0 };
}
function linePiece(source: BoardObject, id: string, a: Point, b: Point, terminal: boolean): BoardObject {
  return { id, type: source.type === 'arrow' && terminal ? 'arrow' : 'line', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)), color: source.color, strokeWidth: source.strokeWidth, text: '', flipY: (b.x - a.x) * (b.y - a.y) < 0, rotation: 0 };
}

/** Splits native line or convex polygon geometry at the exact infinite guide line. */
export function cutObject(source: BoardObject, requested: CutLine, idFactory: () => string = () => crypto.randomUUID()): CutResult | null {
  const line = normalizedLine(requested);
  if (!line || ['circle', 'ellipse', 'text', 'connector'].includes(source.type)) return null;
  const outline = objectOutline(source);
  if (source.type === 'line' || source.type === 'arrow') {
    const [a, b] = outline, segment = subtract(b, a), denominator = cross(segment, line.direction);
    if (Math.abs(denominator) < EPSILON) return null;
    const t = cross(subtract(line.point, a), line.direction) / denominator;
    if (t <= .03 || t >= .97) return null;
    const intersection = lerp(a, b, t);
    return { line, pieces: [linePiece(source, idFactory(), a, intersection, false), linePiece(source, idFactory(), intersection, b, source.type === 'arrow')] };
  }
  if (!validPolygon(outline) || !convex(outline)) return null;
  const sides = outline.map(point => side(line, point));
  if (!sides.some(value => value > .05) || !sides.some(value => value < -.05)) return null;
  const positive = clipHalfPlane(outline, line, true), negative = clipHalfPlane(outline, line, false);
  const sourceArea = area(outline), minimumArea = Math.max(100, sourceArea * .01);
  if (!validPolygon(positive) || !validPolygon(negative) || area(positive) < minimumArea || area(negative) < minimumArea) return null;
  if (Math.abs(area(positive) + area(negative) - sourceArea) > Math.max(2, sourceArea * 1e-5)) return null;
  return { line, pieces: [styled(source, idFactory(), positive), styled(source, idFactory(), negative)] };
}
