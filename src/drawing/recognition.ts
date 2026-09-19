import type { BoardObject, Point, Stroke } from '../core/types';
import { bounds, distanceToSegment, pathLength } from '../selection/geometry';
import { objectOutline } from './objects';

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
  const ellipse: BoardObject = { ...base, type: 'ellipse' };
  const ellipseError = polygonError(points, objectOutline(ellipse), true, diag);
  const a = w / 2, c = h / 2, ellipsePerimeter = Math.PI * (3 * (a + c) - Math.sqrt((3 * a + c) * (a + 3 * c)));
  if (ellipseError < 0.039 && length > ellipsePerimeter * 0.8 && length < ellipsePerimeter * 1.25)
    return { object: ellipse, confidence: Math.max(0.7, 1 - ellipseError * 6 - closure) };
  return null;
}
