import type { BoardObject, Point, Settings, Size, TransformMode } from '../core/types';
import { manipulateSelection, unwrapAngle } from '../drawing/spatial';
import { fingerExtensionScores, palmCenter, thumbExtensionScore } from './pose';

export type FistManipulationState = 'IDLE' | 'CANDIDATE' | 'GRABBED' | 'WAITING_FOR_RELEASE';
export interface FistPose { active: boolean; confidence: number; anchor: Point; apparentSize: number; orientation: number; reliableSize: boolean; reliableOrientation: boolean }
export interface FistOptions { holdMs: number; smoothing: number; scaleGain: number; scaleDeadZone: number; rotationDeadZone: number; nearSize: number; farSize: number; mode: Settings['objectGestureMode'] }
export interface FistUpdate {
  preview?: BoardObject[];
  commit?: { before: BoardObject[]; after: BoardObject[]; mode: TransformMode };
  translation: Point; scale: number; angle: number; rejection: string | null;
}
const clone = (objects: BoardObject[]): BoardObject[] => objects.map(object => ({ ...object, vertices: object.vertices?.map(point => ({ ...point })) }));
const distance = (a: Point, b: Point, size: Size): number => Math.hypot((a.x - b.x) * size.width / Math.max(size.width, size.height), (a.y - b.y) * size.height / Math.max(size.width, size.height));
const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Fist pose metrics use several aspect-correct palm/knuckle distances; no absolute depth is inferred. */
export function classifyFistManipulation(points: Point[], size: Size): FistPose {
  const inactive: FistPose = { active: false, confidence: 0, anchor: points.length === 21 ? palmCenter(points) : { x: .5, y: .5 }, apparentSize: 0, orientation: 0, reliableSize: false, reliableOrientation: false };
  if (points.length !== 21 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return inactive;
  const fingers = fingerExtensionScores(points, size), thumb = thumbExtensionScore(points, size);
  const confidence = Math.max(0, Math.min(1, ...fingers.map(value => (0.5 - value) / .24), (0.68 - thumb) / .3));
  const samples = [distance(points[0], points[5], size), distance(points[0], points[9], size), distance(points[0], points[13], size), distance(points[0], points[17], size), distance(points[5], points[17], size)];
  const apparentSize = median(samples), spread = (Math.max(...samples) - Math.min(...samples)) / Math.max(apparentSize, 1e-6);
  const axis = { x: (points[5].x - points[17].x) * size.width, y: (points[5].y - points[17].y) * size.height };
  return {
    active: fingers.every(value => value <= .42) && thumb <= .62 && confidence >= .35,
    confidence, anchor: palmCenter(points), apparentSize, orientation: Math.atan2(axis.y, axis.x),
    reliableSize: apparentSize >= .025 && apparentSize <= .6 && spread <= 1.35,
    reliableOrientation: Math.hypot(axis.x, axis.y) >= 12,
  };
}

export class FistManipulationController {
  state: FistManipulationState = 'IDLE';
  translation: Point = { x: 0, y: 0 };
  scale = 1;
  angle = 0;
  baselineSize = 0;
  currentSize = 0;
  rejection: string | null = null;
  private candidateAt = 0;
  private releaseAt: number | null = null;
  private baseline: BoardObject[] = [];
  private baselineAnchor: Point = { x: 0, y: 0 };
  private baselineOrientation = 0;
  private unwrappedOrientation = 0;
  private lastReliableSize = 0;
  private lastOrientation = 0;

  update(pose: FistPose, mappedAnchor: Point, objects: BoardObject[], nearSelection: boolean, now: number, options: FistOptions): FistUpdate {
    const result = (): FistUpdate => ({ translation: { ...this.translation }, scale: this.scale, angle: this.angle, rejection: this.rejection });
    if (this.state === 'WAITING_FOR_RELEASE') {
      if (!pose.active) this.reset();
      return result();
    }
    if (!pose.active || pose.confidence < .35) {
      if (this.state === 'GRABBED') {
        this.releaseAt ??= now;
        if (now - this.releaseAt < 90) return result();
        const before = clone(this.baseline), after = manipulateSelection(before, this.translation, this.scale, this.angle);
        this.state = 'WAITING_FOR_RELEASE';
        return { ...result(), commit: after && JSON.stringify(after) !== JSON.stringify(before) ? { before, after, mode: this.transformMode(options.mode) } : undefined };
      }
      this.state = 'IDLE'; this.candidateAt = 0; this.releaseAt = null;
      return result();
    }
    this.releaseAt = null;
    if (this.state === 'IDLE') {
      if (!objects.length || !nearSelection) { this.rejection = objects.length ? 'Fist is outside the selected content' : 'Select native objects before grabbing'; return result(); }
      this.state = 'CANDIDATE'; this.candidateAt = now; this.rejection = null; return result();
    }
    if (this.state === 'CANDIDATE') {
      if (!nearSelection) { this.reset(); this.rejection = 'Fist moved away before acquisition'; return result(); }
      if (now - this.candidateAt < options.holdMs) return result();
      this.state = 'GRABBED'; this.baseline = clone(objects); this.baselineAnchor = { ...mappedAnchor };
      this.baselineSize = pose.apparentSize; this.currentSize = pose.apparentSize; this.lastReliableSize = pose.apparentSize;
      this.baselineOrientation = pose.orientation; this.unwrappedOrientation = pose.orientation; this.lastOrientation = pose.orientation;
      this.translation = { x: 0, y: 0 }; this.scale = 1; this.angle = 0; this.rejection = null;
      return { ...result(), preview: clone(this.baseline) };
    }
    const smoothing = Math.max(.1, Math.min(.8, options.smoothing));
    const targetTranslation = { x: mappedAnchor.x - this.baselineAnchor.x, y: mappedAnchor.y - this.baselineAnchor.y };
    this.translation.x += (targetTranslation.x - this.translation.x) * smoothing;
    this.translation.y += (targetTranslation.y - this.translation.y) * smoothing;
    const orientation = pose.reliableOrientation ? unwrapAngle(this.unwrappedOrientation, pose.orientation) : this.unwrappedOrientation;
    const orientationStep = Math.abs(orientation - this.lastOrientation);
    if (pose.reliableOrientation) { this.unwrappedOrientation = orientation; this.lastOrientation = orientation; }
    if (options.mode === 'move-rotate' || options.mode === 'full') {
      const target = pose.reliableOrientation ? orientation - this.baselineOrientation : this.angle;
      const dead = Math.abs(target) < options.rotationDeadZone ? 0 : target;
      this.angle += (dead - this.angle) * smoothing;
    } else this.angle = 0;
    if (options.mode === 'move-scale' || options.mode === 'full') {
      const jump = Math.abs(pose.apparentSize - this.lastReliableSize) / Math.max(this.lastReliableSize, 1e-6);
      const ambiguous = !pose.reliableSize || jump > .18 || (orientationStep > Math.PI / 15 && jump > .08);
      if (ambiguous) this.rejection = 'Ambiguous apparent hand size; scale held';
      else {
        this.currentSize = pose.apparentSize; this.lastReliableSize = pose.apparentSize; this.rejection = null;
        const calibratedSpan = Math.max(.03, options.nearSize - options.farSize);
        const delta = (pose.apparentSize - this.baselineSize) / calibratedSpan;
        const target = Math.max(.25, Math.min(4, 1 + delta * .65 * options.scaleGain));
        const dead = Math.abs(target - 1) < options.scaleDeadZone ? 1 : target;
        this.scale += (dead - this.scale) * smoothing;
      }
    } else this.scale = 1;
    const preview = manipulateSelection(this.baseline, this.translation, this.scale, this.angle);
    if (!preview) { this.rejection = 'Transform would leave the board'; return { ...result(), preview: manipulateSelection(this.baseline, this.translation, 1, this.angle) ?? clone(this.baseline) }; }
    return { ...result(), preview };
  }
  trackingLost(): void { if (this.state === 'GRABBED' || this.state === 'CANDIDATE') this.state = 'WAITING_FOR_RELEASE'; this.clearPreviewValues(); this.rejection = 'Tracking lost; preview cancelled'; }
  cancel(): void { this.reset(); }
  private transformMode(mode: Settings['objectGestureMode']): TransformMode { return mode === 'move-scale' ? 'move-scale' : mode === 'move-rotate' ? 'move-rotate' : mode === 'full' ? 'move-scale-rotate' : 'move'; }
  private clearPreviewValues(): void { this.baseline = []; this.translation = { x: 0, y: 0 }; this.scale = 1; this.angle = 0; this.baselineSize = 0; this.currentSize = 0; }
  private reset(): void { this.state = 'IDLE'; this.candidateAt = 0; this.releaseAt = null; this.rejection = null; this.clearPreviewValues(); this.baselineAnchor = { x: 0, y: 0 }; this.baselineOrientation = 0; this.unwrappedOrientation = 0; this.lastReliableSize = 0; this.lastOrientation = 0; }
}
