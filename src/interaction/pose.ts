import type { Point, Size } from '../core/types';
import { normalizedPinch } from '../input/pinch';

export type StaticGesture = 'pinch' | 'open-palm' | 'index-only' | 'fist' | 'neutral';
export interface PoseClassification { gesture: StaticGesture; confidence: number; extended: boolean[] }
export type ConfirmationPose = 'CONFIRM_YES' | 'CONFIRM_NO' | 'neutral';
export interface ConfirmationClassification { gesture: ConfirmationPose; confidence: number; scores: [number, number, number, number, number] }

const distance = (a: Point, b: Point, size: Size) => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
const angle = (a: Point, b: Point, c: Point, size: Size): number => {
  const ax = (a.x - b.x) * size.width, ay = (a.y - b.y) * size.height;
  const cx = (c.x - b.x) * size.width, cy = (c.y - b.y) * size.height;
  const denominator = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (denominator < 1e-6) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / denominator))) * 180 / Math.PI;
};
const fingerExtensionScores = (points: Point[], size: Size): number[] => {
  const joints = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  return joints.map(([mcp, pip, dip, tip]) => {
    const straightness = Math.min(angle(points[mcp], points[pip], points[dip], size), angle(points[pip], points[dip], points[tip], size));
    const radial = distance(points[tip], points[0], size) / Math.max(1, distance(points[pip], points[0], size));
    return Math.min(1, Math.max(0, (straightness - 105) / 55)) * 0.6 + Math.min(1, Math.max(0, (radial - 1.02) / 0.28)) * 0.4;
  });
};

/** Uses joint straightness plus wrist distance, so rotated hands do not depend on screen-up. */
export function classifyPose(points: Point[], size: Size, pinchClose = 0.28): PoseClassification {
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return { gesture: 'neutral', confidence: 0, extended: [false, false, false, false] };
  }
  if (normalizedPinch(points, size) <= pinchClose) return { gesture: 'pinch', confidence: 1, extended: [false, false, false, false] };
  const scores = fingerExtensionScores(points, size);
  const extended = scores.map(score => score >= 0.62);
  const folded = scores.map(score => score <= 0.38);
  if (extended.every(Boolean)) return { gesture: 'open-palm', confidence: Math.min(...scores), extended };
  if (extended[0] && folded.slice(1).every(Boolean)) return { gesture: 'index-only', confidence: Math.min(scores[0], ...scores.slice(1).map(score => 1 - score)), extended };
  if (folded.every(Boolean)) return { gesture: 'fist', confidence: Math.min(...scores.map(score => 1 - score)), extended };
  return { gesture: 'neutral', confidence: 1 - Math.min(1, Math.max(...scores) - Math.min(...scores)), extended };
}

/** Rotation-independent landmark rules for the non-dominant hand during a pending confirmation. */
export function classifyConfirmationPose(points: Point[], size: Size): ConfirmationClassification {
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return { gesture: 'neutral', confidence: 0, scores: [0, 0, 0, 0, 0] };
  const fingers = fingerExtensionScores(points, size);
  const thumbStraight = Math.min(angle(points[1], points[2], points[3], size), angle(points[2], points[3], points[4], size));
  const thumbRadial = distance(points[4], points[0], size) / Math.max(1, distance(points[2], points[0], size));
  const thumb = Math.min(1, Math.max(0, (thumbStraight - 105) / 55)) * .55 + Math.min(1, Math.max(0, (thumbRadial - 1.08) / .42)) * .45;
  const scores: [number, number, number, number, number] = [thumb, fingers[0], fingers[1], fingers[2], fingers[3]];
  const palm = Math.max(1, (distance(points[0], points[9], size) + distance(points[5], points[17], size)) / 2);
  const vSeparation = distance(points[8], points[12], size) / palm;
  const yesConfidence = Math.min(fingers[0], fingers[1], 1 - fingers[2], 1 - fingers[3], 1 - thumb, Math.min(1, vSeparation / .2));
  if (fingers[0] >= .68 && fingers[1] >= .68 && fingers[2] <= .34 && fingers[3] <= .34 && thumb <= .52 && vSeparation >= .16) return { gesture: 'CONFIRM_YES', confidence: yesConfidence, scores };
  const noConfidence = Math.min(thumb, fingers[3], 1 - fingers[0], 1 - fingers[1], 1 - fingers[2]);
  if (thumb >= .62 && fingers[3] >= .68 && fingers[0] <= .34 && fingers[1] <= .34 && fingers[2] <= .34) return { gesture: 'CONFIRM_NO', confidence: noConfidence, scores };
  return { gesture: 'neutral', confidence: Math.max(0, Math.min(yesConfidence, noConfidence)), scores };
}

export function palmCenter(points: Point[]): Point {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce((sum, index) => ({ x: sum.x + points[index].x / indices.length, y: sum.y + points[index].y / indices.length }), { x: 0, y: 0 });
}

export function handednessName(categories: { categoryName: string; score: number }[]): 'Left' | 'Right' | null {
  const best = [...categories].sort((a, b) => b.score - a.score)[0];
  return best && (best.categoryName === 'Left' || best.categoryName === 'Right') ? best.categoryName : null;
}

/** MediaPipe assumes selfie-mirrored input. AirBoard inference receives raw unmirrored video, so swap once here. */
export function anatomicalHandedness(categories: { categoryName: string; score: number }[], inputMirrored = false, minimumScore = 0): 'Left' | 'Right' | null {
  const best = [...categories].sort((a, b) => b.score - a.score)[0];
  const raw = handednessName(categories);
  if (!raw || !best || best.score < minimumScore) return null;
  if (inputMirrored) return raw;
  return raw === 'Left' ? 'Right' : 'Left';
}
