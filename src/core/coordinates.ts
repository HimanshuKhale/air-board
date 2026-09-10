import type { Fit, Point, Rect, Size } from './types';
export function fitRect(source: Size, target: Size, fit: Fit): Rect {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) throw new Error('Dimensions must be positive');
  if (fit === 'stretch') return { x: 0, y: 0, ...target };
  const scale = (fit === 'cover' ? Math.max : Math.min)(target.width / source.width, target.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  return { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height };
}
export function cameraToCanvas(raw: Point, camera: Size, canvas: Size, mirror: boolean, fit: Fit): Point {
  const rect = fitRect(camera, canvas, fit);
  return { x: rect.x + (mirror ? 1 - raw.x : raw.x) * rect.width, y: rect.y + raw.y * rect.height };
}
export function clientToCanvas(point: Point, viewport: Rect, canvas: Size): Point {
  return { x: (point.x - viewport.x) * canvas.width / viewport.width, y: (point.y - viewport.y) * canvas.height / viewport.height };
}
export function canvasToClient(point: Point, viewport: Rect, canvas: Size): Point {
  return { x: viewport.x + point.x * viewport.width / canvas.width, y: viewport.y + point.y * viewport.height / canvas.height };
}
export function inside(point: Point, size: Size): boolean { return point.x >= 0 && point.y >= 0 && point.x <= size.width && point.y <= size.height; }
