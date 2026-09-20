import type { CutLine, Point, Size } from '../core/types';
import { fingerExtensionScores, thumbExtensionScore } from './pose';

export type ScissorState = 'IDLE' | 'OPEN_SCISSORS' | 'GUIDE_ACTIVE' | 'SNIP_DETECTED' | 'COMMITTED' | 'WAITING_FOR_REOPEN';
export interface ScissorPose { validArticulation: boolean; open: boolean; closed: boolean; confidence: number; separation: number; guideAnchor: Point; guideDirection: Point }
export interface ScissorUpdate { guide?: CutLine; snip: boolean; state: ScissorState }
const distance = (a: Point, b: Point, size: Size): number => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);

/** The cut guide is perpendicular to the projected wrist-to-index/middle-knuckle finger axis. */
export function classifyScissors(points: Point[], size: Size): ScissorPose {
  const inactive: ScissorPose = { validArticulation: false, open: false, closed: false, confidence: 0, separation: 0, guideAnchor: { x: .5, y: .5 }, guideDirection: { x: 1, y: 0 } };
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return inactive;
  const fingers = fingerExtensionScores(points, size), thumb = thumbExtensionScore(points, size);
  const palm = Math.max(1, (distance(points[0], points[9], size) + distance(points[5], points[17], size)) / 2);
  const separation = distance(points[8], points[12], size) / palm;
  const articulation = fingers[0] >= .6 && fingers[1] >= .6 && fingers[2] <= .4 && fingers[3] <= .4 && thumb <= .7;
  const confidence = Math.max(0, Math.min(1, fingers[0], fingers[1], 1 - fingers[2], 1 - fingers[3], 1 - Math.max(0, thumb - .35)));
  const guideAnchor = { x: (points[8].x + points[12].x) / 2, y: (points[8].y + points[12].y) / 2 };
  const base = { x: (points[5].x + points[9].x) / 2, y: (points[5].y + points[9].y) / 2 };
  const axis = { x: (guideAnchor.x - base.x) * size.width, y: (guideAnchor.y - base.y) * size.height };
  const length = Math.max(1e-6, Math.hypot(axis.x, axis.y));
  const guideDirection = { x: -axis.y / length, y: axis.x / length };
  return { validArticulation: articulation && confidence >= .45, open: articulation && separation >= .34, closed: articulation && separation <= .2, confidence, separation, guideAnchor, guideDirection };
}

export class ScissorController {
  state: ScissorState = 'IDLE';
  private openAt = 0;
  private closeAt: number | null = null;
  constructor(private readonly holdMs = 180, private readonly closeHoldMs = 55) {}
  update(pose: ScissorPose, mappedAnchor: Point, mappedDirection: Point, now: number): ScissorUpdate {
    const guide = (): CutLine => ({ point: { ...mappedAnchor }, direction: { ...mappedDirection } });
    if (this.state === 'COMMITTED') { this.state = 'WAITING_FOR_REOPEN'; return { state: this.state, snip: false }; }
    if (this.state === 'WAITING_FOR_REOPEN') {
      if (pose.open) { this.state = 'OPEN_SCISSORS'; this.openAt = now; }
      return { state: this.state, snip: false };
    }
    if (!pose.validArticulation) { this.reset(); return { state: this.state, snip: false }; }
    if (this.state === 'IDLE') {
      if (pose.open) { this.state = 'OPEN_SCISSORS'; this.openAt = now; }
      return { state: this.state, snip: false };
    }
    if (this.state === 'OPEN_SCISSORS') {
      if (!pose.open) { this.reset(); return { state: this.state, snip: false }; }
      if (now - this.openAt >= this.holdMs) this.state = 'GUIDE_ACTIVE';
      return { state: this.state, snip: false, guide: this.state === 'GUIDE_ACTIVE' ? guide() : undefined };
    }
    if (this.state === 'GUIDE_ACTIVE') {
      if (pose.closed) {
        this.closeAt ??= now;
        if (now - this.closeAt >= this.closeHoldMs) { this.state = 'SNIP_DETECTED'; return { state: this.state, snip: true, guide: guide() }; }
      } else this.closeAt = null;
      return { state: this.state, snip: false, guide: guide() };
    }
    return { state: this.state, snip: false };
  }
  committed(): void { this.state = 'COMMITTED'; }
  rejected(): void { this.state = 'WAITING_FOR_REOPEN'; }
  trackingLost(): void { this.reset(); }
  reset(): void { this.state = 'IDLE'; this.openAt = 0; this.closeAt = null; }
}
