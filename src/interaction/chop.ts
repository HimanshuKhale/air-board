import type { Point, Size } from '../core/types';
import { fingerExtensionScores, palmCenter, thumbExtensionScore } from './pose';

export interface ChopPose { active: boolean; confidence: number; center: Point; scale: number }
export interface ChopUpdate { counted: boolean; count: number; finalize: boolean }
export type ChopState = 'ARMED' | 'SWIPING' | 'WAITING_FOR_RETURN';
const distance = (a: Point, b: Point, size: Size) => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
export function classifyChopPose(points: Point[], size: Size): ChopPose {
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return { active: false, confidence: 0, center: { x: .5, y: .5 }, scale: 1 };
  const fingers = fingerExtensionScores(points, size), thumb = thumbExtensionScore(points, size), center = palmCenter(points);
  const straight = Math.min(...fingers), together = 1 - Math.min(1, distance(points[8], points[20], size) / Math.max(1, distance(points[5], points[17], size)) / 1.4);
  const confidence = Math.max(0, Math.min(straight, 1 - thumb, together));
  return { active: fingers.every(value => value >= .58) && thumb <= .48 && together >= .35, confidence, center, scale: Math.max(1, distance(points[0], points[9], size)) };
}
export class ChopController {
  state: ChopState = 'ARMED';
  count = 0;
  private start: Point | null = null;
  private startAt = 0;
  private lastCountAt = 0;
  constructor(private readonly inactivityMs = 1300, private readonly maximum = 12) {}
  update(pose: ChopPose, size: Size, now: number): ChopUpdate {
    if (this.count && now - this.lastCountAt >= this.inactivityMs) return { counted: false, count: this.count, finalize: true };
    if (!pose.active || pose.confidence < .45) {
      if (this.state === 'WAITING_FOR_RETURN') this.state = 'ARMED';
      else if (this.state === 'SWIPING') this.state = 'ARMED';
      this.start = null; return { counted: false, count: this.count, finalize: false };
    }
    if (this.state === 'WAITING_FOR_RETURN') return { counted: false, count: this.count, finalize: false };
    if (!this.start) { this.start = pose.center; this.startAt = now; this.state = 'SWIPING'; return { counted: false, count: this.count, finalize: false }; }
    const travel = distance(this.start, pose.center, size) / pose.scale, elapsed = Math.max(1, now - this.startAt), velocity = travel / elapsed;
    if (travel >= .5 && velocity >= .0016) {
      this.count = Math.min(this.maximum, this.count + 1); this.lastCountAt = now; this.state = 'WAITING_FOR_RETURN'; this.start = null;
      return { counted: true, count: this.count, finalize: false };
    }
    return { counted: false, count: this.count, finalize: false };
  }
  tick(now: number): ChopUpdate { return { counted: false, count: this.count, finalize: !!this.count && now - this.lastCountAt >= this.inactivityMs }; }
  reset(): void { this.state = 'ARMED'; this.count = 0; this.start = null; this.startAt = 0; this.lastCountAt = 0; }
}
