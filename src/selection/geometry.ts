import type { Point, Stroke } from '../core/types';
import { polygonArea } from '../calibration/homography';
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export const bounds = (points: Point[]): Bounds => points.reduce((box, p) => ({ minX: Math.min(box.minX, p.x), minY: Math.min(box.minY, p.y), maxX: Math.max(box.maxX, p.x), maxY: Math.max(box.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
export const boundsIntersect = (a: Bounds, b: Bounds) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}
export const pathLength = (points: Point[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
export function distanceToStroke(point: Point, stroke: Stroke): number {
  if (!stroke.points.length) return Infinity;
  if (stroke.points.length === 1) return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y);
  let nearest = Infinity;
  for (let i = 1; i < stroke.points.length; i++) nearest = Math.min(nearest, distanceToSegment(point, stroke.points[i - 1], stroke.points[i]));
  return nearest;
}
export function nearestStroke(strokes: Stroke[], point: Point, radius: number, ids?: string[]): Stroke | null {
  const eligible = ids ? new Set(ids) : null;
  let found: Stroke | null = null, distance = radius;
  for (const stroke of strokes) {
    if (stroke.brush.tool === 'eraser' || (eligible && !eligible.has(stroke.id))) continue;
    const candidate = distanceToStroke(point, stroke);
    if (candidate <= distance) { found = stroke; distance = candidate; }
  }
  return found;
}
export function validLasso(points: Point[], closeRadius: number): boolean {
  return points.length >= 12 && pathLength(points) >= 180 && polygonArea(points) >= 1800 && Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) <= closeRadius;
}
function sampled(points: Point[], spacing = 12): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    result.push(points[i]);
    if (!i) continue;
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = spacing; d < length; d += spacing) result.push({ x: a.x + (b.x - a.x) * d / length, y: a.y + (b.y - a.y) * d / length });
  }
  return result;
}
/** Selects drawable strands whose bounds intersect and >=30% sampled points are inside. */
export function selectStrokes(strokes: Stroke[], polygon: Point[]): string[] {
  const polygonBounds = bounds(polygon);
  return strokes.filter(stroke => stroke.brush.tool !== 'eraser' && stroke.points.length && boundsIntersect(bounds(stroke.points), polygonBounds))
    .filter(stroke => { const points = sampled(stroke.points); return points.filter(point => pointInPolygon(point, polygon)).length / points.length >= 0.3; })
    .map(stroke => stroke.id);
}
