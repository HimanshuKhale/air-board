import { BOARD, type Point, type Size } from '../core/types';
import { palmCenter } from './pose';

/** Virtual nib: thumb/index midpoint extended outward along the palm-to-pinch direction. */
export function virtualNib(points: Point[], size: Size, extensionRatio = 0.18): Point | null {
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)) || size.width <= 0 || size.height <= 0) return null;
  const pinch = { x: (points[4].x + points[8].x) / 2, y: (points[4].y + points[8].y) / 2 };
  const palm = palmCenter(points);
  const vx = (pinch.x - palm.x) * size.width, vy = (pinch.y - palm.y) * size.height;
  const length = Math.hypot(vx, vy);
  const palmScale = (Math.hypot((points[0].x - points[9].x) * size.width, (points[0].y - points[9].y) * size.height) +
    Math.hypot((points[5].x - points[17].x) * size.width, (points[5].y - points[17].y) * size.height)) / 2;
  if (length < 1 || palmScale < 1) return pinch;
  const extension = palmScale * extensionRatio;
  return { x: pinch.x + vx / length * extension / size.width, y: pinch.y + vy / length * extension / size.height };
}
export function applyStylusOffset(point: Point, offset: Point): Point {
  return { x: point.x + offset.x * BOARD.width, y: point.y + offset.y * BOARD.height };
}
export function calibrateStylusOffset(mappedNib: Point, target: Point = { x: BOARD.width / 2, y: BOARD.height / 2 }): Point {
  return { x: (target.x - mappedNib.x) / BOARD.width, y: (target.y - mappedNib.y) / BOARD.height };
}
