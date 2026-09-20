import type { BoardObject, Point, Size } from '../core/types';
import { fingerExtensionScores, palmCenter, thumbExtensionScore } from './pose';
import { transformSelection, unwrapAngle } from '../drawing/spatial';

export interface ThreeFingerPose { active: boolean; confidence: number; extension: number; angle: number; anchor: Point }
export type SpatialTransformState = 'IDLE' | 'CANDIDATE' | 'ACTIVE' | 'WAITING_FOR_RELEASE';
export interface SpatialTransformUpdate { preview?: BoardObject[]; commit?: { before: BoardObject[]; after: BoardObject[]; mode: 'scale' | 'rotate' }; scale: number; angle: number }
export interface SpatialTransformOptions { holdMs?: number; gain?: number; smoothing?: number; scaleDeadZone?: number; rotationDeadZone?: number }

export function classifyThreeFingerTransform(points: Point[], size: Size): ThreeFingerPose {
  const inactive = { active: false, confidence: 0, extension: 0, angle: 0, anchor: points.length === 21 ? palmCenter(points) : { x: .5, y: .5 } };
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return inactive;
  const fingers = fingerExtensionScores(points, size), thumb = thumbExtensionScore(points, size);
  const extension = (fingers[1] + fingers[2] + fingers[3]) / 3;
  const constrained = Math.min(1 - thumb, 1 - fingers[0]);
  const usable = Math.min(...fingers.slice(1).map(value => Math.min((value - .12) / .18, (.97 - value) / .15)));
  const confidence = Math.max(0, Math.min(1, constrained, usable));
  const base = { x: (points[9].x + points[13].x) / 2, y: (points[9].y + points[13].y) / 2 };
  const angle = Math.atan2(base.y - points[0].y, base.x - points[0].x);
  return { active: thumb <= .5 && fingers[0] <= .48 && fingers.slice(1).every(value => value >= .12 && value <= .97) && confidence >= .45, confidence, extension, angle, anchor: palmCenter(points) };
}

const clone = (objects: BoardObject[]) => objects.map(object => ({ ...object, vertices: object.vertices?.map(point => ({ ...point })) }));
export class SpatialTransformController {
  state: SpatialTransformState = 'IDLE';
  scale = 1;
  angle = 0;
  private candidateAt = 0;
  private baseline: BoardObject[] = [];
  private baselineExtension = 0;
  private baselineAngle = 0;
  private unwrappedAngle = 0;
  constructor(private readonly holdMs = 220, private readonly gain = 1.5) {}
  update(pose: ThreeFingerPose, objects: BoardObject[], mode: 'scale' | 'rotate', now: number, options: SpatialTransformOptions = {}): SpatialTransformUpdate {
    if (!pose.active || pose.confidence < .45) {
      if (this.state === 'ACTIVE') {
        const before = clone(this.baseline), after = transformSelection(before, this.scale, this.angle);
        this.state = 'WAITING_FOR_RELEASE';
        return { commit: after && JSON.stringify(after) !== JSON.stringify(before) ? { before, after, mode } : undefined, scale: this.scale, angle: this.angle };
      }
      if (this.state === 'WAITING_FOR_RELEASE') this.reset(); else this.state = 'IDLE';
      return { scale: this.scale, angle: this.angle };
    }
    if (this.state === 'WAITING_FOR_RELEASE') return { scale: this.scale, angle: this.angle };
    if (this.state === 'IDLE') { this.state = 'CANDIDATE'; this.candidateAt = now; return { scale: 1, angle: 0 }; }
    if (this.state === 'CANDIDATE') {
      if (now - this.candidateAt < (options.holdMs ?? this.holdMs)) return { scale: 1, angle: 0 };
      this.state = 'ACTIVE'; this.baseline = clone(objects); this.baselineExtension = pose.extension; this.baselineAngle = pose.angle; this.unwrappedAngle = pose.angle; this.scale = 1; this.angle = 0;
      return { preview: clone(this.baseline), scale: 1, angle: 0 };
    }
    this.unwrappedAngle = unwrapAngle(this.unwrappedAngle, pose.angle);
    const scaleTarget = mode === 'scale' ? Math.max(.25, Math.min(4, 1 + (pose.extension - this.baselineExtension) * (options.gain ?? this.gain))) : 1;
    const angleTarget = mode === 'rotate' ? this.unwrappedAngle - this.baselineAngle : 0;
    const deadScale = Math.abs(scaleTarget - 1) < (options.scaleDeadZone ?? .03) ? 1 : scaleTarget;
    const deadAngle = Math.abs(angleTarget) < (options.rotationDeadZone ?? Math.PI / 60) ? 0 : angleTarget;
    const smoothing = Math.max(.1, Math.min(.8, options.smoothing ?? .35));
    this.scale += (deadScale - this.scale) * smoothing; this.angle += (deadAngle - this.angle) * smoothing;
    const preview = transformSelection(this.baseline, this.scale, this.angle);
    return { preview: preview ?? clone(this.baseline), scale: this.scale, angle: this.angle };
  }
  cancel(): void { this.reset(); }
  reset(): void { this.state = 'IDLE'; this.baseline = []; this.candidateAt = 0; this.scale = 1; this.angle = 0; this.baselineExtension = 0; this.baselineAngle = 0; this.unwrappedAngle = 0; }
}
