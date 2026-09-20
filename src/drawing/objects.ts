import type { BoardObject, Point } from '../core/types';
import { distanceToSegment, pointInPolygon } from '../selection/geometry';
import { objectCenter, pointBounds, worldPoint } from './spatial';

export function objectOutline(object: BoardObject): Point[] {
  const rotate = (points: Point[]) => points.map(point => worldPoint(object, point));
  if (object.vertices?.length) return rotate(object.vertices);
  const { x, y, width: w, height: h } = object;
  switch (object.type) {
    case 'line': case 'arrow': case 'connector': return rotate(object.flipY ? [{ x, y: y + h }, { x: x + w, y }] : [{ x, y }, { x: x + w, y: y + h }]);
    case 'triangle': return rotate([{ x: x + w / 2, y }, { x: x + w, y: y + h }, { x, y: y + h }]);
    case 'circle': case 'ellipse': return rotate(Array.from({ length: 25 }, (_, i) => ({ x: x + w / 2 + Math.cos(i * Math.PI / 12) * w / 2, y: y + h / 2 + Math.sin(i * Math.PI / 12) * h / 2 })));
    default: return rotate([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]);
  }
}
export const objectBounds = (object: BoardObject): { x: number; y: number; width: number; height: number } => pointBounds(objectOutline(object));
/** Resolves a relationship to the current node positions for rendering and hit testing. */
export function attachedConnector(connector: BoardObject, from: BoardObject, to: BoardObject): BoardObject {
  const fromCenter = objectCenter(from), toCenter = objectCenter(to);
  const length = Math.hypot(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y) || 1;
  const axis = { x: (toCenter.x - fromCenter.x) / length, y: (toCenter.y - fromCenter.y) / length };
  const projection = (point: Point, center: Point) => (point.x - center.x) * axis.x + (point.y - center.y) * axis.y;
  const fromOutline = objectOutline(from), toOutline = objectOutline(to);
  const a = fromOutline.reduce((best, point) => projection(point, fromCenter) > projection(best, fromCenter) ? point : best, fromOutline[0]);
  const b = toOutline.reduce((best, point) => projection(point, toCenter) < projection(best, toCenter) ? point : best, toOutline[0]);
  return { ...connector, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(a.x - b.x)), height: Math.max(1, Math.abs(a.y - b.y)), flipY: (b.x - a.x) * (b.y - a.y) < 0 };
}
export function distanceToObject(point: Point, object: BoardObject): number {
  const outline = objectOutline(object);
  if (!['line', 'arrow', 'connector'].includes(object.type) && pointInPolygon(point, outline)) return 0;
  let result = Infinity;
  for (let i = 0; i < outline.length - (['line', 'arrow', 'connector'].includes(object.type) ? 1 : 0); i++)
    result = Math.min(result, distanceToSegment(point, outline[i], outline[(i + 1) % outline.length]));
  return result;
}
export function nearestObject(objects: BoardObject[], point: Point, radius: number, ids?: string[]): BoardObject | null {
  let nearest: BoardObject | null = null, distance = radius;
  for (const object of objects) {
    if (ids && !ids.includes(object.id)) continue;
    const candidate = distanceToObject(point, object);
    if (candidate <= distance) { nearest = object; distance = candidate; }
  }
  return nearest;
}
export function selectObjects(objects: BoardObject[], polygon: Point[]): string[] {
  return objects.filter(object => {
    const outline = objectOutline(object);
    return outline.filter(point => pointInPolygon(point, polygon)).length >= Math.ceil(outline.length * 0.3) ||
      pointInPolygon(objectCenter(object), polygon);
  }).map(object => object.id);
}
export function paintObject(ctx: CanvasRenderingContext2D, object: BoardObject): void {
  const { x, y, width: w, height: h } = object;
  ctx.save(); ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = object.color; ctx.fillStyle = object.color; ctx.lineWidth = object.strokeWidth;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const outline = objectOutline(object);
  if (object.type === 'text') {
    const center = objectCenter(object); ctx.translate(center.x, center.y); ctx.rotate(object.rotation ?? 0);
    ctx.font = `${Math.max(12, Math.min(72, h * 0.7))}px sans-serif`;
    ctx.textBaseline = 'middle'; ctx.fillText(object.text, -w / 2, 0, w);
  } else {
    ctx.beginPath();
    if (object.type === 'circle' || object.type === 'ellipse') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, object.rotation ?? 0, 0, Math.PI * 2);
    else {
      ctx.moveTo(outline[0].x, outline[0].y);
      for (const point of outline.slice(1)) ctx.lineTo(point.x, point.y);
      if (!['line', 'arrow', 'connector'].includes(object.type)) ctx.closePath();
    }
    ctx.stroke();
    if (object.type === 'arrow' || object.type === 'connector') {
      const end = outline[1], start = outline[0], angle = Math.atan2(end.y - start.y, end.x - start.x), size = Math.max(12, object.strokeWidth * 3);
      ctx.beginPath(); ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6)); ctx.stroke();
    }
    if (object.text) {
      const size = Math.max(12, Math.min(36, h * 0.3));
      ctx.font = `${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const center = objectCenter(object); ctx.save(); ctx.translate(center.x, center.y); ctx.rotate(object.rotation ?? 0);
      ctx.fillText(object.text, 0, 0, Math.max(1, w - 8)); ctx.restore();
    }
  }
  ctx.restore();
}
