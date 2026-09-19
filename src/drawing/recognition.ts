import type { BoardObject, Point, Stroke } from '../core/types';
import { bounds, distanceToSegment, pathLength } from '../selection/geometry';
import { objectOutline } from './objects';
import { validPolygon, vertexBounds } from './geometry';

export interface Recognition { object: BoardObject; confidence: number }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function sample(points: Point[], count = 64): Point[] {
  const length = pathLength(points), result: Point[] = [];
  if (!length) return points;
  let index = 1, travelled = 0;
  for (let i = 0; i < count; i++) {
    const target = length * i / (count - 1);
    while (index < points.length - 1 && travelled + distance(points[index - 1], points[index]) < target) travelled += distance(points[index - 1], points[index++]);
    const a = points[index - 1], b = points[index], segment = distance(a, b);
    const t = segment ? Math.min(1, Math.max(0, (target - travelled) / segment)) : 0;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}
function polygonError(points: Point[], outline: Point[], closed: boolean, scale: number): number {
  const edges = closed ? outline.length : outline.length - 1;
  return points.reduce((sum, point) => {
    let d = Infinity;
    for (let i = 0; i < edges; i++) d = Math.min(d, distanceToSegment(point, outline[i], outline[(i + 1) % outline.length]));
    return sum + d / scale;
  }, 0) / points.length;
}
function cornersCovered(points: Point[], corners: Point[], scale: number): boolean {
  return corners.every(corner => Math.min(...points.map(point => distance(point, corner))) < scale * 0.1);
}
function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let max = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) { const d = distanceToSegment(points[i], points[0], points.at(-1)!); if (d > max) { max = d; index = i; } }
  if (max <= epsilon) return [points[0], points.at(-1)!];
  return [...rdp(points.slice(0, index + 1), epsilon).slice(0, -1), ...rdp(points.slice(index), epsilon)];
}
function closedCorners(points: Point[], epsilon: number): Point[] {
  const farthest = points.reduce((best, point, i) => distance(point, points[0]) > distance(points[best], points[0]) ? i : best, 1);
  const result = [...rdp(points.slice(0, farthest + 1), epsilon).slice(0, -1), ...rdp(points.slice(farthest), epsilon)];
  if (distance(result[0], result.at(-1)!) <= epsilon * 2) result.pop();
  return result;
}
const edgeAngle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
const parallel = (a: number, b: number) => Math.abs(Math.sin(a - b)) < .22;
function rightAngle(a: Point, b: Point, c: Point): boolean {
  const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
  return Math.abs((u.x * v.x + u.y * v.y) / Math.max(1, Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))) < .22;
}
function interiorAngle(a: Point, b: Point, c: Point): number {
  const u = { x: a.x - b.x, y: a.y - b.y }, v = { x: c.x - b.x, y: c.y - b.y };
  const cosine = (u.x * v.x + u.y * v.y) / Math.max(1, Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
function polygonKind(vertices: Point[]): BoardObject['type'] {
  if (vertices.length === 3) return 'triangle';
  if (vertices.length === 5) return 'pentagon';
  if (vertices.length === 6) return 'hexagon';
  if (vertices.length !== 4) return 'polygon';
  const angles = vertices.map((point, i) => edgeAngle(point, vertices[(i + 1) % 4]));
  const orthogonal = vertices.every((point, i) => rightAngle(vertices[(i + 3) % 4], point, vertices[(i + 1) % 4]));
  if (orthogonal) {
    const b = vertexBounds(vertices), ratio = b.width / b.height;
    return ratio > .82 && ratio < 1.22 ? 'square' : 'rectangle';
  }
  const pairs = Number(parallel(angles[0], angles[2])) + Number(parallel(angles[1], angles[3]));
  return pairs === 2 ? 'parallelogram' : pairs === 1 ? 'trapezoid' : 'polygon';
}
/** Geometry-only recognizer. It never mutates history and excludes eraser/highlighter ink. */
export function recognizeStroke(stroke: Stroke): Recognition | null {
  if (stroke.brush.tool !== 'pen' || stroke.points.length < 8) return null;
  const points = sample(stroke.points), b = bounds(points), w = b.maxX - b.minX, h = b.maxY - b.minY, diag = Math.hypot(w, h), length = pathLength(stroke.points);
  if (diag < 75 || length < 85 || w < 3 && h < 3) return null;
  const start = points[0], end = points.at(-1)!, closure = distance(start, end) / diag;
  const base = { id: crypto.randomUUID(), x: b.minX, y: b.minY, width: Math.max(w, 1), height: Math.max(h, 1), color: stroke.brush.color, strokeWidth: stroke.brush.size, text: '' };
  const lineObject = (a: Point, z: Point, type: 'line' | 'arrow'): BoardObject => ({ ...base, type, x: Math.min(a.x, z.x), y: Math.min(a.y, z.y), width: Math.max(1, Math.abs(z.x - a.x)), height: Math.max(1, Math.abs(z.y - a.y)), flipY: (z.x - a.x) * (z.y - a.y) < 0 });
  if (closure > 0.7) {
    const error = points.reduce((sum, point) => sum + distanceToSegment(point, start, end) / diag, 0) / points.length;
    if (error < 0.035 && length / distance(start, end) < 1.16) return { object: lineObject(start, end, 'line'), confidence: Math.min(0.99, 1 - error * 4) };
    // A shaft followed by a two-segment head. Closed and multi-loop marks never qualify.
    for (let i = Math.floor(points.length * 0.45); i < Math.floor(points.length * 0.8); i++) {
      const tip = points[i], shaft = distance(start, tip), wing1 = points[Math.min(points.length - 1, i + 8)], wing2 = end;
      if (shaft < diag * 0.65 || distanceToSegment(wing1, start, tip) < diag * 0.09 || distanceToSegment(wing2, start, tip) < diag * 0.09) continue;
      if (distance(tip, wing1) < shaft * 0.12 || distance(tip, wing2) < shaft * 0.12 || distance(tip, wing1) > shaft * 0.5 || distance(tip, wing2) > shaft * 0.5) continue;
      const shaftError = polygonError(points.slice(0, i + 1), [start, tip], false, diag);
      if (shaftError < 0.045) return { object: lineObject(start, tip, 'arrow'), confidence: 0.8 };
    }
    return null;
  }
  if (closure > 0.17 || w < 35 || h < 35 || length > 2.2 * (w + h)) return null;
  const corners = closedCorners(stroke.points, diag * .035);
  const visiblyCornered = corners.length <= 6 || corners.every((vertex, i) => interiorAngle(corners[(i + corners.length - 1) % corners.length], vertex, corners[(i + 1) % corners.length]) <= 132);
  if (corners.length >= 3 && corners.length <= 12 && visiblyCornered && validPolygon(corners)) {
    const kind = polygonKind(corners), error = polygonError(points, corners, true, diag);
    const perimeter = corners.reduce((sum, p, i) => sum + distance(p, corners[(i + 1) % corners.length]), 0);
    if (error < .025 && length > perimeter * .76 && length < perimeter * 1.3 && cornersCovered(points, corners, diag)) {
      const box = vertexBounds(corners);
      return { object: { ...base, ...box, type: kind, vertices: corners, regular: kind === 'square' || kind === 'pentagon' || kind === 'hexagon' }, confidence: Math.max(.7, 1 - error * 5 - closure) };
    }
  }
  const rectangle: BoardObject = { ...base, type: 'rectangle' };
  const rectOutline = objectOutline(rectangle), rectError = polygonError(points, rectOutline, true, diag);
  const perimeter = 2 * (w + h);
  if (rectError < 0.046 && length > perimeter * 0.77 && length < perimeter * 1.28 && cornersCovered(points, rectOutline, diag))
    return { object: rectangle, confidence: Math.max(0.7, 1 - rectError * 5 - closure) };
  const triangle: BoardObject = { ...base, type: 'triangle' }, triOutline = objectOutline(triangle);
  const triPerimeter = triOutline.reduce((sum, p, i) => sum + distance(p, triOutline[(i + 1) % 3]), 0);
  const triError = polygonError(points, triOutline, true, diag);
  if (triError < 0.05 && length > triPerimeter * 0.75 && length < triPerimeter * 1.3 && cornersCovered(points, triOutline, diag))
    return { object: triangle, confidence: Math.max(0.7, 1 - triError * 5 - closure) };
  const ellipse: BoardObject = { ...base, type: w / h > .86 && w / h < 1.16 ? 'circle' : 'ellipse' };
  const ellipseError = polygonError(points, objectOutline(ellipse), true, diag);
  const a = w / 2, c = h / 2, ellipsePerimeter = Math.PI * (3 * (a + c) - Math.sqrt((3 * a + c) * (a + 3 * c)));
  if (ellipseError < 0.039 && length > ellipsePerimeter * 0.8 && length < ellipsePerimeter * 1.25)
    return { object: ellipse, confidence: Math.max(0.7, 1 - ellipseError * 6 - closure) };
  return null;
}
