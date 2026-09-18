import type { Point, Size } from '../core/types';
import { normalizedPinch } from '../input/pinch';

export type StaticGesture = 'pinch' | 'open-palm' | 'index-only' | 'fist' | 'neutral';
export interface PoseClassification { gesture: StaticGesture; confidence: number; extended: boolean[] }

const distance = (a: Point, b: Point, size: Size) => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
const angle = (a: Point, b: Point, c: Point, size: Size): number => {
  const ax = (a.x - b.x) * size.width, ay = (a.y - b.y) * size.height;
  const cx = (c.x - b.x) * size.width, cy = (c.y - b.y) * size.height;
  const denominator = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (denominator < 1e-6) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / denominator))) * 180 / Math.PI;
};

/** Uses joint straightness plus wrist distance, so rotated hands do not depend on screen-up. */
export function classifyPose(points: Point[], size: Size, pinchClose = 0.28): PoseClassification {
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return { gesture: 'neutral', confidence: 0, extended: [false, false, false, false] };
  }
  if (normalizedPinch(points, size) <= pinchClose) return { gesture: 'pinch', confidence: 1, extended: [false, false, false, false] };
  const joints = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  const scores = joints.map(([mcp, pip, dip, tip]) => {
    const straightness = Math.min(angle(points[mcp], points[pip], points[dip], size), angle(points[pip], points[dip], points[tip], size));
    const radial = distance(points[tip], points[0], size) / Math.max(1, distance(points[pip], points[0], size));
    return Math.min(1, Math.max(0, (straightness - 105) / 55)) * 0.6 + Math.min(1, Math.max(0, (radial - 1.02) / 0.28)) * 0.4;
  });
  const extended = scores.map(score => score >= 0.62);
  const folded = scores.map(score => score <= 0.38);
  if (extended.every(Boolean)) return { gesture: 'open-palm', confidence: Math.min(...scores), extended };
  if (extended[0] && folded.slice(1).every(Boolean)) return { gesture: 'index-only', confidence: Math.min(scores[0], ...scores.slice(1).map(score => 1 - score)), extended };
  if (folded.every(Boolean)) return { gesture: 'fist', confidence: Math.min(...scores.map(score => 1 - score)), extended };
  return { gesture: 'neutral', confidence: 1 - Math.min(1, Math.max(...scores) - Math.min(...scores)), extended };
}

export function palmCenter(points: Point[]): Point {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce((sum, index) => ({ x: sum.x + points[index].x / indices.length, y: sum.y + points[index].y / indices.length }), { x: 0, y: 0 });
}

export function handednessName(categories: { categoryName: string; score: number }[]): 'Left' | 'Right' | null {
  const best = [...categories].sort((a, b) => b.score - a.score)[0];
  return best && (best.categoryName === 'Left' || best.categoryName === 'Right') ? best.categoryName : null;
}
