import { BOARD, type BoardState, type Brush, type CutLine, type Point, type ReactionEvent, type Settings, type Size } from '../core/types';
import type { Command } from '../sync/protocol';
import type { TrackingResult } from '../tracking/protocol';
import { GestureController } from '../input/gesture';
import type { HandPointer } from '../input/gesture';
import type { PinchPhase } from '../input/pinch';
import { ExponentialFilter } from '../input/filter';
import { anatomicalHandedness, classifyConfirmationPose, classifyFourFingertipPinch, classifyPose, handednessName, palmCenter, type ConfirmationPose, type StaticGesture } from './pose';
import { PoseStabilizer } from './temporal';
import { currentObjects, currentStrokes } from '../drawing/history';
import { nearestObject, selectObjects } from '../drawing/objects';
import { bounds, nearestStroke, pathLength, selectStrokes, validLasso } from '../selection/geometry';
import type { MovePreview } from '../drawing/history';
import { TwoHandToggle, twoHandsClose } from './two-hand';
import { applyStylusOffset, calibrateStylusOffset, virtualNib } from './stylus';
import { homographyFromQuad } from '../calibration/homography';
import { nearestShapeHandle, shapeHandles, transformObject, type ShapeHandle } from '../drawing/transform';
import type { BoardObject } from '../core/types';
import { PenWritingController } from './pen-writing';
import { ReactionController, type ReactionState } from '../reactions/controller';
import { classifyReactionPose } from '../reactions/pose';
import { classifyFistManipulation, FistManipulationController, type FistManipulationState } from './fist-manipulation';
import { classifyScissors, ScissorController, type ScissorState } from './scissors';
import { cutObject } from '../drawing/cutting';

export type InteractionMode = 'hover' | 'write' | 'erase' | 'lasso' | 'drag' | 'shape-transform' | 'fist-manipulation' | 'scissor-cut' | 'plane-calibration' | 'stylus-calibration';
export interface InteractionDiagnostics {
  dominantHand: 'Left' | 'Right'; detectedHands: string[]; instantaneousGesture: StaticGesture;
  stableGesture: StaticGesture; gestureEnterMs: number; interaction: InteractionMode;
  handControl: 'enabled' | 'paused'; rawPoint: Point | null; mappedPoint: Point | null;
  lassoActive: boolean; selectedStrokeCount: number; grabbedStrokeId: string | null; planeCalibrationActive: boolean; planeCalibrationValid: boolean;
  inputMode: Settings['inputMode']; virtualNibPoint: Point | null; twoHandClose: boolean; twoHandHeldMs: number;
  confirmationGesture: ConfirmationPose; confirmationConfidence: number;
  writingHand: 'Left' | 'Right'; confirmationHand: 'Left' | 'Right'; penDown: boolean; fourFingertipConfidence: number;
  reactionState: ReactionState; reactionGesture: string; reactionConfidence: number;
  spatialState: FistManipulationState; scissorState: ScissorState; spatialScale: number; spatialAngle: number;
  fistConfidence: number; fistBaselineSize: number; fistCurrentSize: number; fistRejection: string | null;
  scissorConfidence: number; scissorSeparation: number; cutGuide: CutLine | null; cutValid: boolean; cutRejection: string | null;
}
export interface InteractionHooks {
  send(command: Command): void;
  routePinch(point: Point, phase: PinchPhase): void;
  endPinch(): void;
  map(point: Point, size: Size, settings: Settings): Point;
  showPointer(point: Point, diameter: number, held: boolean, label: string): void;
  getState(): BoardState;
  toast(message: string): void;
  previewMove?(preview: MovePreview | null): void;
  previewObject?(preview: BoardObject | null): void;
  previewObjects?(previews: BoardObject[] | null, hiddenIds?: string[]): void;
  confirmationPending?(): boolean;
  confirmationPose?(pose: ConfirmationPose, confidence: number, now: number): void;
  confirmationInterrupted?(): void;
  reaction?(event: ReactionEvent): void;
}
export interface InteractionVisuals { lasso: Point[]; lassoStart: Point | null; planeTarget: number | null; planeCaptured: Point[]; movePreview: MovePreview | null; objectPreview: BoardObject | null; objectPreviews: BoardObject[]; spatialLabel: string | null; cutGuide: CutLine | null; cutValid: boolean; stylusTarget: boolean }

export class InteractionController {
  pointer: HandPointer | null = null;
  readonly diagnostics: InteractionDiagnostics = {
    dominantHand: 'Right', detectedHands: [], instantaneousGesture: 'neutral', stableGesture: 'neutral', gestureEnterMs: 0,
    interaction: 'hover', handControl: 'enabled', rawPoint: null, mappedPoint: null,
    lassoActive: false, selectedStrokeCount: 0, grabbedStrokeId: null, planeCalibrationActive: false, planeCalibrationValid: false,
    inputMode: 'finger', virtualNibPoint: null, twoHandClose: false, twoHandHeldMs: 0, confirmationGesture: 'neutral', confirmationConfidence: 0,
    writingHand: 'Right', confirmationHand: 'Left', penDown: false, fourFingertipConfidence: 0,
    reactionState: 'IDLE', reactionGesture: 'neutral', reactionConfidence: 0,
    spatialState: 'IDLE', scissorState: 'IDLE', spatialScale: 1, spatialAngle: 0,
    fistConfidence: 0, fistBaselineSize: 0, fistCurrentSize: 0, fistRejection: null,
    scissorConfidence: 0, scissorSeparation: 0, cutGuide: null, cutValid: false, cutRejection: null,
  };
  readonly visuals: InteractionVisuals = { lasso: [], lassoStart: null, planeTarget: null, planeCaptured: [], movePreview: null, objectPreview: null, objectPreviews: [], spatialLabel: null, cutGuide: null, cutValid: false, stylusTarget: false };
  private gesture = new GestureController();
  private pen = new PenWritingController();
  private pose = new PoseStabilizer();
  private twoHand = new TwoHandToggle();
  private reaction = new ReactionController();
  private fistManipulation = new FistManipulationController();
  private scissors = new ScissorController();
  private spatialMode: Settings['objectGestureMode'] = 'move';
  private cutPreview: { source: BoardObject; pieces: [BoardObject, BoardObject]; line: CutLine } | null = null;
  private lastFistSize = 0;
  private palmFilter = new ExponentialFilter(0.55);
  private fistFilter = new ExponentialFilter(0.55);
  private eraserId: string | null = null;
  private erasing = false;
  private shapeErasePoint: Point | null = null;
  private erasedObjects = new Set<string>();
  private lastDominant: string | null = null;
  private lasso: Point[] = [];
  private lassoAt = 0;
  private blockedPose: StaticGesture | null = null;
  private planeCapture: Point[] | null = null;
  private drag: { ids: string[]; start: Point; current: Point } | null = null;
  private stylusCapture = false;
  private shapeTransform: { baseline: BoardObject; handle: ShapeHandle; preview: BoardObject } | null = null;
  private lassoCandidateAt: number | null = null;
  private lassoGestureLatched = false;
  private lassoBlocked = false;
  private handednessCheck: 'Left' | 'Right' | null = null;
  constructor(private hooks: InteractionHooks) {}
  startHandednessCheck(expected: 'Left' | 'Right'): void { this.handednessCheck = expected; this.hooks.toast(`Raise only your physical ${expected.toLowerCase()} hand.`); }
  update(result: TrackingResult, size: Size, now: number, settings: Settings): void {
    this.diagnostics.dominantHand = settings.dominantHand;
    const confirmationHand = settings.dominantHand === 'Right' ? 'Left' : 'Right';
    this.diagnostics.writingHand = settings.dominantHand; this.diagnostics.confirmationHand = confirmationHand;
    this.diagnostics.handControl = settings.paused ? 'paused' : 'enabled';
    this.diagnostics.inputMode = settings.inputMode;
    this.diagnostics.selectedStrokeCount = this.hooks.getState().selection.length;
    this.diagnostics.planeCalibrationValid = !!settings.planePoints;
    if (this.spatialMode !== settings.objectGestureMode) { this.cancelSpatial(); this.spatialMode = settings.objectGestureMode; }
    const hands = result.allLandmarks.map((landmarks, index) => {
      const categories = result.stats.handedness[index] ?? [], raw = handednessName(categories), name = anatomicalHandedness(categories, false, .7);
      const gesture = landmarks.length === 21 ? classifyPose(landmarks, size, settings.pinchClose).gesture : 'neutral';
      return { landmarks, categories, raw, name, gesture };
    });
    this.diagnostics.detectedHands = hands.map(hand => `raw ${hand.raw ?? 'Unknown'} -> physical ${hand.name ?? 'uncertain'} ${(hand.categories[0]?.score ?? 0).toFixed(2)} · ${hand.gesture}`);
    if (this.handednessCheck && hands.length === 1 && hands[0].name) {
      const expected = this.handednessCheck, actual = hands[0].name; this.handednessCheck = null;
      this.hooks.toast(actual === expected ? `Verified: physical ${expected} is identified as ${actual}.` : `Mismatch: raised ${expected}, tracker reported ${actual}. Keep Debug open and retry.`);
    }
    const confirmationPending = this.hooks.confirmationPending?.() ?? false;
    if (confirmationPending) {
      const confirmationSource = hands.find(hand => hand.name === confirmationHand && hand.landmarks.length === 21);
      const confirmation = confirmationSource ? classifyConfirmationPose(confirmationSource.landmarks, size) : { gesture: 'neutral' as const, confidence: 0 };
      this.diagnostics.confirmationGesture = confirmation.gesture; this.diagnostics.confirmationConfidence = confirmation.confidence;
      if (confirmationSource) this.hooks.confirmationPose?.(confirmation.gesture, confirmation.confidence, now); else this.hooks.confirmationInterrupted?.();
      this.twoHand.reset();
    } else {
      this.diagnostics.confirmationGesture = 'neutral'; this.diagnostics.confirmationConfidence = 0;
    }
    if (confirmationPending && (this.fistManipulation.state !== 'IDLE' || this.scissors.state !== 'IDLE')) this.cancelSpatial();
    const externalWriting = !!this.hooks.getState().history.active;
    const operationActive = !!this.shapeTransform || !!this.lasso.length || this.pen.down || this.erasing || !!this.drag || this.fistManipulation.state === 'GRABBED' || this.scissors.state === 'GUIDE_ACTIVE' || externalWriting;
    const proximityClose = twoHandsClose(hands.map(hand => hand.landmarks), size, settings.twoHandProximity);
    const toggleHandControl = confirmationPending || operationActive ? false : this.twoHand.update(hands.map(hand => hand.landmarks), size, now, settings.twoHandHoldMs, settings.twoHandProximity);
    this.diagnostics.twoHandClose = confirmationPending ? false : proximityClose; this.diagnostics.twoHandHeldMs = this.twoHand.state.heldMs;
    if (toggleHandControl) {
      this.reaction.suppress();
      this.cancelActive(); this.cancelCalibrations();
      const paused = !settings.paused;
      this.hooks.send({ type: 'settings', patch: { paused } });
      this.diagnostics.handControl = paused ? 'paused' : 'enabled';
      this.hooks.toast(paused ? 'Hand Control Paused. Mouse and touch remain available.' : 'Hand Control Enabled.');
      return;
    }
    if (!confirmationPending && !operationActive && proximityClose) { this.reaction.suppress(); this.cancelSpatial(); this.syncReactionDiagnostics(); this.hooks.endPinch(); this.diagnostics.interaction = 'hover'; return; }
    if (settings.paused) { this.reaction.suppress(); this.syncReactionDiagnostics(); this.cancelActive(); this.diagnostics.handControl = 'paused'; return; }
    const calibrating = !!this.planeCapture || this.stylusCapture;
    const dominant = hands.find(hand => hand.name === settings.dominantHand && hand.landmarks.length === 21);
    const selectedObjects = currentObjects(this.hooks.getState().history).filter(object => this.hooks.getState().selection.includes(object.id));
    if (externalWriting && (settings.objectGestureMode === 'cut' || this.fistManipulation.state !== 'IDLE')) { this.reaction.suppress(); this.syncReactionDiagnostics(); return; }
    const validNativeSelection = selectedObjects.length > 0 && selectedObjects.length === this.hooks.getState().selection.length && !selectedObjects.some(object => object.type === 'connector');
    const fistPose = dominant ? classifyFistManipulation(dominant.landmarks, size) : null;
    if (fistPose) { this.lastFistSize = fistPose.apparentSize; this.diagnostics.fistConfidence = fistPose.confidence; this.diagnostics.fistCurrentSize = fistPose.apparentSize; }
    const fistArmed = !confirmationPending && !calibrating && validNativeSelection && settings.objectGestureMode !== 'cut' && (!!fistPose?.active || this.fistManipulation.state !== 'IDLE');
    const cutArmed = !confirmationPending && !calibrating && settings.objectGestureMode === 'cut' && selectedObjects.length === 1 && this.hooks.getState().selection.length === 1;
    if (fistArmed || cutArmed) {
      this.reaction.suppress(); this.syncReactionDiagnostics(); this.cancelBoardOperationsForSpatial();
      if (!dominant) { this.cancelSpatialTracking(); return; }
      if (cutArmed) this.updateScissorCut(dominant.landmarks, size, now, selectedObjects[0]);
      else this.updateFistManipulation(fistPose!, size, now, selectedObjects);
      return;
    }
    if (settings.objectGestureMode === 'cut') {
      this.reaction.suppress(); this.syncReactionDiagnostics();
      this.diagnostics.cutRejection = this.hooks.getState().selection.length === 1 ? 'The selected item is not an eligible native object' : 'Cut mode requires exactly one selected object';
      this.visuals.spatialLabel = 'WAITING FOR ONE OBJECT'; return;
    }
    if (confirmationPending || calibrating || proximityClose || !settings.reactionsEnabled) this.reaction.suppress();
    else {
      const source = hands.find(hand => hand.name === confirmationHand && hand.landmarks.length === 21);
      if (source) {
        const pose = classifyReactionPose(source.landmarks, size);
        const mapped = this.hooks.map(pose.anchor, size, settings);
        const event = this.reaction.update(pose, { x: Math.max(0, Math.min(1, mapped.x / BOARD.width)), y: Math.max(0, Math.min(1, mapped.y / BOARD.height)) }, now, settings);
        if (event) this.hooks.reaction?.(event);
      } else this.reaction.trackingLost();
    }
    this.syncReactionDiagnostics();
    if (!dominant) { this.cancelActive(); return; }
    if (this.lastDominant && this.lastDominant !== dominant.name) this.reset();
    this.lastDominant = dominant.name;
    const classification = classifyPose(dominant.landmarks, size, settings.pinchClose);
    const sensitivity = settings.gestureSensitivity === 'gentle' ? 1.2 : settings.gestureSensitivity === 'responsive' ? 0.8 : 1;
    const stable = this.pose.update(classification.gesture, classification.confidence, now, gesture => gesture === 'open-palm' ? settings.openPalmHoldMs * sensitivity : 180 * sensitivity);
    Object.assign(this.diagnostics, { instantaneousGesture: stable.instantaneous, stableGesture: stable.stable, gestureEnterMs: stable.enterElapsedMs });
    if (this.blockedPose && classification.gesture !== this.blockedPose) this.blockedPose = null;
    // A fist drag follows the palm, so release it before the index-tip pointer adapter can reject a large finger-only jump.
    if (this.drag) {
      if (classification.gesture !== 'fist') this.endDrag(true);
      else { this.continueDrag(dominant.landmarks, size, now, settings); return; }
    }
    const nib = settings.inputMode === 'pen' ? virtualNib(dominant.landmarks, size) : null;
    this.diagnostics.virtualNibPoint = nib;
    const pinchPointer = this.gesture.update(dominant.landmarks, size, now, { ...settings, paused: false });
    const penPointer = settings.inputMode === 'pen' ? this.pen.update(dominant.landmarks, size, now, settings) : null;
    if (settings.inputMode !== 'pen') this.pen.reset();
    this.diagnostics.penDown = this.pen.down;
    const pointer = pinchPointer ?? penPointer;
    this.pointer = settings.inputMode === 'pen' ? penPointer ?? pinchPointer : pinchPointer;
    if (!pointer) { this.cancelActive(); return; }
    const raw = pointer.raw;
    const baseMapped = this.hooks.map(pointer.smooth, size, settings);
    const mapped = baseMapped;
    const penBaseMapped = penPointer ? this.hooks.map(penPointer.smooth, size, settings) : null;
    const penMapped = penBaseMapped ? applyStylusOffset(penBaseMapped, settings.stylusOffset) : null;
    this.diagnostics.rawPoint = raw; this.diagnostics.mappedPoint = mapped;
    if (this.planeCapture) {
      const phase = pinchPointer?.phase ?? 'hover'; this.capturePlanePoint(pointer.smooth, phase); this.diagnostics.interaction = 'plane-calibration';
      this.hooks.showPointer(mapped, 18, phase === 'pinchStart' || phase === 'pinchHold', String(this.planeCapture.length + 1));
      return;
    }
    if (this.stylusCapture) {
      this.diagnostics.interaction = 'stylus-calibration';
      const calibrationPoint = penMapped ?? mapped, phase = penPointer?.phase ?? 'hover';
      this.hooks.showPointer(calibrationPoint, 18, phase === 'pinchStart' || phase === 'pinchHold', 'P');
      if (phase === 'pinchStart' && penBaseMapped) {
        const stylusOffset = calibrateStylusOffset(penBaseMapped);
        this.hooks.send({ type: 'settings', patch: { stylusOffset } });
        this.stylusCapture = false; this.visuals.stylusTarget = false;
        this.hooks.toast('Pen Writing virtual nib offset calibrated and saved locally.');
      }
      return;
    }
    if (this.shapeTransform && pinchPointer) {
      if (pinchPointer.phase === 'pinchEnd' || pinchPointer.phase === 'hover') this.endShapeTransform(pinchPointer.phase === 'pinchEnd');
      else {
        const preview = transformObject(this.shapeTransform.baseline, this.shapeTransform.handle, mapped, settings.shapeResizeMode);
        if (preview) { this.shapeTransform.preview = preview; this.visuals.objectPreview = preview; this.hooks.previewObject?.(preview); }
        this.diagnostics.interaction = 'shape-transform'; this.hooks.showPointer(mapped, 22, true, 'S');
      }
      return;
    }
    if (pinchPointer?.phase === 'pinchStart' && this.beginShapeTransform(mapped, settings)) return;
    if (penPointer?.phase === 'pinchEnd' && penMapped) {
      this.hooks.routePinch(penMapped, 'pinchEnd'); this.diagnostics.interaction = 'hover'; this.hooks.showPointer(penMapped, 18, false, 'P↑'); return;
    }
    const cluster = classifyFourFingertipPinch(dominant.landmarks, size);
    this.diagnostics.fourFingertipConfidence = cluster.confidence;
    const clusterWithinReleaseBand = cluster.distances.length === 6
      && cluster.distances.slice(0, 4).every(value => value <= .62)
      && cluster.distances[4] <= .78 && cluster.distances[5] >= .3;
    if (settings.lassoGesture === 'four-fingertip') {
      if (cluster.active) this.lassoGestureLatched = true;
      else if (!clusterWithinReleaseBand) { this.lassoGestureLatched = false; this.lassoBlocked = false; }
    } else {
      this.lassoGestureLatched = false;
      if (classification.gesture !== 'index-only') this.lassoBlocked = false;
    }
    const lassoPose = settings.lassoGesture === 'four-fingertip' ? this.lassoGestureLatched : classification.gesture === 'index-only';
    if (lassoPose) this.lassoCandidateAt ??= now; else this.lassoCandidateAt = null;
    const clusterCenter = [4, 8, 12, 16, 20].reduce((sum, index) => ({ x: sum.x + dominant.landmarks[index].x / 5, y: sum.y + dominant.landmarks[index].y / 5 }), { x: 0, y: 0 });
    const lassoRaw = settings.lassoGesture === 'four-fingertip' ? clusterCenter : dominant.landmarks[8];
    const lassoMapped = this.hooks.map(lassoRaw, size, settings);
    // Active lasso, pen, eraser and drag each retain ownership until their explicit release.
    if (this.lasso.length) {
      if (!lassoPose || now - this.lassoAt > 8000) { if (lassoPose) this.lassoBlocked = true; this.cancelLasso(); }
      else { this.continueLasso(lassoMapped, now, settings); return; }
    }
    if (this.pen.down && penPointer && penMapped) {
      this.diagnostics.rawPoint = penPointer.raw; this.diagnostics.mappedPoint = penMapped; this.diagnostics.interaction = 'write';
      this.hooks.routePinch(penMapped, penPointer.phase); this.hooks.showPointer(penMapped, 18, true, 'P'); return;
    }
    if (lassoPose) {
      this.hooks.endPinch();
      if (this.lassoCandidateAt !== null && now - this.lassoCandidateAt >= settings.lassoHoldMs && !this.lassoBlocked && this.blockedPose !== 'index-only') this.beginLasso(lassoMapped, now);
      else this.hooks.showPointer(lassoMapped, 18, false, 'L');
      return;
    }
    if (this.erasing) {
      if (classification.gesture !== 'open-palm') this.endErase();
      else { this.continueErase(dominant.landmarks, size, now, settings); return; }
    }
    if (stable.stable === 'open-palm' && classification.gesture === 'open-palm') {
      this.hooks.endPinch();
      this.beginErase(dominant.landmarks, size, now, settings); return;
    }
    if (stable.stable === 'fist' && classification.gesture === 'fist' && this.blockedPose !== 'fist') {
      this.hooks.endPinch(); this.beginDrag(dominant.landmarks, size, now, settings); return;
    }
    if (classification.gesture === 'fist') {
      this.hooks.endPinch(); this.diagnostics.interaction = 'hover';
      this.hooks.showPointer(mapped, 14, false, 'G'); return;
    }
    if (settings.inputMode === 'pen') {
      this.diagnostics.interaction = 'hover';
      if (penMapped) this.hooks.showPointer(penMapped, 18, false, 'P↑');
      return;
    }
    const phase = pinchPointer?.phase ?? 'hover'; this.diagnostics.interaction = phase === 'pinchStart' || phase === 'pinchHold' ? 'write' : 'hover'; this.hooks.routePinch(mapped, phase);
  }
  startPlaneCalibration(): void {
    this.cancelActive(); this.stylusCapture = false; this.visuals.stylusTarget = false; this.planeCapture = []; this.visuals.planeCaptured = []; this.visuals.planeTarget = 0;
    this.diagnostics.planeCalibrationActive = true; this.hooks.toast('Plane calibration: point to Top Left and pinch.');
  }
  resetPlaneCalibration(): void {
    this.planeCapture = null; this.visuals.planeCaptured = []; this.visuals.planeTarget = null;
    this.diagnostics.planeCalibrationActive = false; this.hooks.send({ type: 'settings', patch: { planePoints: null } });
    this.hooks.toast('Writing-plane calibration reset.');
  }
  startStylusCalibration(): void {
    this.cancelActive(); this.planeCapture = null; this.visuals.planeCaptured = []; this.visuals.planeTarget = null;
    this.diagnostics.planeCalibrationActive = false;
    if (this.hooks.getState().settings.inputMode !== 'pen') this.hooks.send({ type: 'settings', patch: { inputMode: 'pen' } });
    this.stylusCapture = true; this.visuals.stylusTarget = true;
    this.hooks.toast('Align the estimated nib to the center, release the grip once, then hold the three-point pen grip.');
  }
  resetStylusCalibration(): void {
    this.stylusCapture = false; this.visuals.stylusTarget = false;
    this.hooks.send({ type: 'settings', patch: { stylusOffset: { x: 0, y: 0 } } });
    this.hooks.toast('Pen Writing virtual nib offset reset.');
  }
  cancelSpatialMode(): void { this.cancelSpatial(); }
  private cancelBoardOperationsForSpatial(): void {
    if (this.shapeTransform) this.endShapeTransform(false);
    if (this.drag) this.endDrag(false);
    if (this.erasing) this.endErase();
    if (this.lasso.length) this.cancelLasso();
    this.hooks.endPinch();
    this.gesture.reset(); this.pen.reset(); this.pose.reset(); this.pointer = null;
  }
  private updateFistManipulation(pose: ReturnType<typeof classifyFistManipulation>, size: Size, now: number, selected: BoardObject[]): void {
    const settings = this.hooks.getState().settings, mapped = this.hooks.map(pose.anchor, size, settings);
    const near = selected.some(object => !!nearestObject([object], mapped, settings.fistGrabRadius));
    const update = this.fistManipulation.update(pose, mapped, selected, near, now, {
      holdMs: settings.spatialTransformHoldMs, smoothing: settings.spatialSmoothing, scaleGain: settings.spatialScaleGain,
      scaleDeadZone: settings.spatialScaleDeadZone, rotationDeadZone: settings.spatialRotationDeadZoneDeg * Math.PI / 180,
      nearSize: settings.fistDepthNear, farSize: settings.fistDepthFar, mode: settings.objectGestureMode,
    });
    Object.assign(this.diagnostics, { spatialState: this.fistManipulation.state, spatialScale: update.scale, spatialAngle: update.angle,
      fistConfidence: pose.confidence, fistBaselineSize: this.fistManipulation.baselineSize, fistCurrentSize: pose.apparentSize, fistRejection: update.rejection });
    this.diagnostics.interaction = 'fist-manipulation';
    this.visuals.spatialLabel = this.fistManipulation.state === 'GRABBED'
      ? `GRABBED  ${Math.round(update.scale * 100)}%  ${update.angle >= 0 ? '+' : ''}${Math.round(update.angle * 180 / Math.PI)}°`
      : this.fistManipulation.state === 'CANDIDATE' ? 'HOLD FIST TO GRAB' : 'WAITING FOR FIST';
    if (update.preview) { this.visuals.objectPreviews = update.preview; this.hooks.previewObjects?.(update.preview); }
    if (update.commit) {
      this.hooks.previewObjects?.(null); this.visuals.objectPreviews = []; this.hooks.send({ type: 'transform-objects', ...update.commit });
      this.hooks.toast('Fist manipulation committed as one action.');
    }
    this.hooks.showPointer(mapped, settings.fistGrabRadius, this.fistManipulation.state === 'GRABBED', this.fistManipulation.state === 'GRABBED' ? 'G' : 'F');
  }
  private mapGuide(size: Size, anchor: Point, direction: Point): CutLine {
    const settings = this.hooks.getState().settings, point = this.hooks.map(anchor, size, settings);
    const sample = this.hooks.map({ x: anchor.x + direction.x * .05, y: anchor.y + direction.y * .05 }, size, settings);
    const vector = { x: sample.x - point.x, y: sample.y - point.y }, length = Math.max(1e-6, Math.hypot(vector.x, vector.y));
    return { point, direction: { x: vector.x / length, y: vector.y / length } };
  }
  private updateScissorCut(points: Point[], size: Size, now: number, selected: BoardObject): void {
    this.diagnostics.interaction = 'scissor-cut';
    const pose = classifyScissors(points, size), line = this.mapGuide(size, pose.guideAnchor, pose.guideDirection);
    const update = this.scissors.update(pose, line.point, line.direction, now);
    Object.assign(this.diagnostics, { scissorState: this.scissors.state, scissorConfidence: pose.confidence, scissorSeparation: pose.separation });
    if (update.guide) this.setCutGuide(selected, update.guide);
    this.visuals.spatialLabel = this.scissors.state === 'GUIDE_ACTIVE' ? (this.visuals.cutValid ? 'SCISSORS OPEN · VALID CUT' : 'SCISSORS OPEN · INVALID CUT')
      : this.scissors.state === 'SNIP_DETECTED' ? 'SNIP ACCEPTED' : 'OPEN SCISSORS';
    if (update.snip) this.commitCut(selected, update.guide!);
    this.hooks.showPointer(line.point, 22, this.scissors.state === 'GUIDE_ACTIVE', '✂');
  }
  private setCutGuide(source: BoardObject, line: CutLine): void {
    const scene = currentObjects(this.hooks.getState().history);
    const attached = scene.some(object => object.type === 'connector' && (object.fromId === source.id || object.toId === source.id));
    let serial = 0; const result = attached ? null : cutObject(source, line, () => `cut-preview-${++serial}`);
    this.cutPreview = result ? { source, pieces: result.pieces, line: result.line } : null;
    this.visuals.cutGuide = line; this.visuals.cutValid = !!result; this.visuals.objectPreviews = result?.pieces ?? [];
    this.hooks.previewObjects?.(result?.pieces ?? null, result ? [source.id] : []);
    Object.assign(this.diagnostics, { cutGuide: line, cutValid: !!result, cutRejection: result ? null : attached ? 'Attached connectors must be removed first' : 'Guide misses, touches a boundary, or creates an unsupported region' });
  }
  private commitCut(source: BoardObject, line: CutLine): void {
    const result = cutObject(source, line);
    if (!result) { this.scissors.rejected(); this.hooks.toast('Invalid cut. Reopen the scissors and position the guide through the object.'); return; }
    this.hooks.send({ type: 'cut-object', source, pieces: result.pieces, line: result.line });
    this.scissors.committed(); this.visuals.spatialLabel = 'SNIP ACCEPTED'; this.hooks.toast('Cut created two independent objects.');
    this.clearCutPreview(); this.hooks.send({ type: 'settings', patch: { objectGestureMode: 'move' } });
  }
  private cancelSpatialTracking(): void { this.fistManipulation.trackingLost(); this.scissors.trackingLost(); this.clearCutPreview(); this.hooks.previewObjects?.(null); }
  private clearCutPreview(): void {
    this.cutPreview = null; this.visuals.cutGuide = null; this.visuals.cutValid = false; this.visuals.objectPreviews = [];
    Object.assign(this.diagnostics, { cutGuide: null, cutValid: false });
  }
  setManualCutGuide(point: Point, direction: Point): boolean {
    const state = this.hooks.getState(), selected = currentObjects(state.history).filter(object => state.selection.includes(object.id));
    if (state.settings.objectGestureMode !== 'cut' || selected.length !== 1 || state.selection.length !== 1) return false;
    const length = Math.hypot(direction.x, direction.y); if (length < 1e-6) return false;
    this.setCutGuide(selected[0], { point: { ...point }, direction: { x: direction.x / length, y: direction.y / length } });
    this.visuals.spatialLabel = this.visuals.cutValid ? 'VALID CUT · APPLY' : 'INVALID CUT'; return true;
  }
  applyManualCut(): void {
    if (!this.cutPreview) { this.hooks.toast('Position a valid cutting guide through the selected object first.'); return; }
    this.commitCut(this.cutPreview.source, this.cutPreview.line);
  }
  calibrateFistDepth(kind: 'near' | 'far'): void {
    if (!this.lastFistSize) { this.hooks.toast('Show the dominant-hand fist to the camera, then capture this point.'); return; }
    this.hooks.send({ type: 'settings', patch: kind === 'near' ? { fistDepthNear: this.lastFistSize } : { fistDepthFar: this.lastFistSize } });
    this.hooks.toast(`Captured relative ${kind} fist size.`);
  }
  private cancelSpatial(): void {
    this.fistManipulation.cancel(); this.scissors.reset(); this.clearCutPreview(); this.visuals.spatialLabel = null;
    this.hooks.previewObjects?.(null); Object.assign(this.diagnostics, { spatialState: 'IDLE', scissorState: 'IDLE', spatialScale: 1, spatialAngle: 0, fistBaselineSize: 0, fistRejection: null });
  }
  private capturePlanePoint(point: Point, phase: PinchPhase): void {
    if (!this.planeCapture || phase !== 'pinchStart') return;
    this.planeCapture.push({ ...point }); this.visuals.planeCaptured = [...this.planeCapture];
    const names = ['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left'];
    if (this.planeCapture.length < 4) {
      this.visuals.planeTarget = this.planeCapture.length;
      this.hooks.toast(`Captured. Point to ${names[this.planeCapture.length]} and pinch.`); return;
    }
    try {
      homographyFromQuad(this.planeCapture);
      this.hooks.send({ type: 'settings', patch: { planePoints: [...this.planeCapture] } });
      this.hooks.toast('Writing plane calibrated and saved locally.');
    } catch (error) {
      this.hooks.toast(error instanceof Error ? error.message : String(error));
    }
    this.planeCapture = null; this.visuals.planeTarget = null; this.diagnostics.planeCalibrationActive = false;
  }
  private beginLasso(point: Point, now: number): void {
    this.endErase(); this.lasso = [{ ...point }]; this.lassoAt = now;
    this.visuals.lasso = [...this.lasso]; this.visuals.lassoStart = { ...point };
    this.diagnostics.interaction = 'lasso'; this.diagnostics.lassoActive = true;
    this.hooks.showPointer(point, 14, true, 'L');
  }
  private continueLasso(point: Point, _now: number, settings: Settings): void {
    const previous = this.lasso.at(-1)!;
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 3) this.lasso.push({ ...point });
    this.visuals.lasso = [...this.lasso]; this.diagnostics.mappedPoint = point;
    this.hooks.showPointer(point, 14, true, 'L');
    const distanceToStart = Math.hypot(point.x - this.lasso[0].x, point.y - this.lasso[0].y);
    if (this.lasso.length >= 12 && pathLength(this.lasso) >= 180 && distanceToStart <= settings.lassoCloseRadius) {
      if (validLasso(this.lasso, settings.lassoCloseRadius)) {
        const ids = [...selectStrokes(currentStrokes(this.hooks.getState().history), this.lasso), ...selectObjects(currentObjects(this.hooks.getState().history), this.lasso)];
        this.hooks.send({ type: 'select', ids });
        this.hooks.toast(ids.length ? `Selected ${ids.length} stroke${ids.length === 1 ? '' : 's'}.` : 'The lasso did not contain a stroke.');
      } else this.hooks.toast('Lasso was too small or narrow. Try a wider loop.');
      this.lassoBlocked = true; this.blockedPose = 'index-only'; this.cancelLasso();
    }
  }
  private cancelLasso(): void {
    this.lasso = []; this.visuals.lasso = []; this.visuals.lassoStart = null;
    this.diagnostics.lassoActive = false; this.diagnostics.interaction = 'hover';
  }
  private eraserPoint(points: Point[], size: Size, now: number, settings: Settings): Point {
    this.palmFilter.alpha = settings.smoothing;
    return this.hooks.map(this.palmFilter.update(palmCenter(points), now), size, settings);
  }
  private beginErase(points: Point[], size: Size, now: number, settings: Settings): void {
    const point = this.eraserPoint(points, size, now, settings);
    const brush: Brush = { tool: 'eraser', color: '#000000', size: settings.palmEraserSize, opacity: 1 };
    this.erasing = true; this.erasedObjects.clear();
    if (this.eraseObject(point, settings.palmEraserSize)) this.shapeErasePoint = point;
    else {
      this.eraserId = crypto.randomUUID(); this.hooks.send({ type: 'begin', id: this.eraserId, brush, point });
    }
    this.diagnostics.interaction = 'erase'; this.diagnostics.mappedPoint = point;
    this.hooks.showPointer(point, settings.palmEraserSize, true, 'E');
  }
  private continueErase(points: Point[], size: Size, now: number, settings: Settings): void {
    const point = this.eraserPoint(points, size, now, settings);
    const hit = this.eraseObject(point, settings.palmEraserSize);
    if (hit && !this.eraserId) this.shapeErasePoint = point;
    if (!this.eraserId && !hit && (!this.shapeErasePoint || Math.hypot(point.x - this.shapeErasePoint.x, point.y - this.shapeErasePoint.y) > settings.palmEraserSize * 0.6)) {
      this.eraserId = crypto.randomUUID();
      this.shapeErasePoint = null;
      this.hooks.send({ type: 'begin', id: this.eraserId, brush: { tool: 'eraser', color: '#000000', size: settings.palmEraserSize, opacity: 1 }, point });
    } else if (this.eraserId) this.hooks.send({ type: 'point', id: this.eraserId, point });
    this.diagnostics.interaction = 'erase'; this.diagnostics.mappedPoint = point;
    this.hooks.showPointer(point, settings.palmEraserSize, true, 'E');
  }
  private endErase(): void {
    if (this.eraserId) this.hooks.send({ type: 'end', id: this.eraserId });
    this.eraserId = null; this.erasing = false; this.shapeErasePoint = null; this.palmFilter.reset(); this.diagnostics.interaction = 'hover';
  }
  private eraseObject(point: Point, diameter: number): boolean {
    const object = nearestObject(currentObjects(this.hooks.getState().history), point, diameter / 2);
    if (object && !this.erasedObjects.has(object.id)) { this.erasedObjects.add(object.id); this.hooks.send({ type: 'delete-object', id: object.id }); }
    return !!object;
  }
  private fistPoint(points: Point[], size: Size, now: number, settings: Settings): Point {
    this.fistFilter.alpha = settings.smoothing;
    return this.hooks.map(this.fistFilter.update(palmCenter(points), now), size, settings);
  }
  private beginDrag(points: Point[], size: Size, now: number, settings: Settings): void {
    const point = this.fistPoint(points, size, now, settings);
    const state = this.hooks.getState(), strokes = currentStrokes(state.history), objects = currentObjects(state.history);
    let ids = state.selection.filter(id => strokes.some(stroke => stroke.id === id && stroke.brush.tool !== 'eraser') || objects.some(object => object.id === id));
    if (ids.length) {
      const selected = strokes.filter(stroke => ids.includes(stroke.id)), selectedObjects = objects.filter(object => ids.includes(object.id));
      const box = bounds([...selected.flatMap(stroke => stroke.points), ...selectedObjects.flatMap(object => [{ x: object.x, y: object.y }, { x: object.x + object.width, y: object.y + object.height }])]), padding = 12;
      const insideSelection = point.x >= box.minX - padding && point.x <= box.maxX + padding && point.y >= box.minY - padding && point.y <= box.maxY + padding;
      if (!insideSelection && !nearestStroke(strokes, point, settings.fistGrabRadius, ids) && !nearestObject(objects, point, settings.fistGrabRadius, ids)) { this.blockedPose = 'fist'; this.fistFilter.reset(); return; }
    } else {
      const nearest = nearestObject(objects, point, settings.fistGrabRadius) ?? nearestStroke(strokes, point, settings.fistGrabRadius);
      if (!nearest) { this.blockedPose = 'fist'; this.fistFilter.reset(); return; }
      ids = [nearest.id]; this.hooks.send({ type: 'select', ids });
    }
    this.drag = { ids, start: point, current: point };
    const preview = { ids, dx: 0, dy: 0 }; this.visuals.movePreview = preview; this.hooks.previewMove?.(preview);
    this.diagnostics.grabbedStrokeId = ids.length === 1 ? ids[0] : `${ids.length} strokes`;
    this.diagnostics.interaction = 'drag'; this.diagnostics.mappedPoint = point;
    this.hooks.showPointer(point, settings.fistGrabRadius, true, 'G');
  }
  private continueDrag(points: Point[], size: Size, now: number, settings: Settings): void {
    if (!this.drag) return;
    const point = this.fistPoint(points, size, now, settings);
    this.drag.current = point;
    const preview = { ids: this.drag.ids, dx: point.x - this.drag.start.x, dy: point.y - this.drag.start.y };
    this.visuals.movePreview = preview; this.hooks.previewMove?.(preview);
    this.diagnostics.interaction = 'drag'; this.diagnostics.mappedPoint = point;
    this.hooks.showPointer(point, settings.fistGrabRadius, true, 'G');
  }
  private endDrag(commit: boolean): void {
    const drag = this.drag;
    this.drag = null; this.visuals.movePreview = null; this.hooks.previewMove?.(null); this.fistFilter.reset();
    this.diagnostics.grabbedStrokeId = null; this.diagnostics.interaction = 'hover';
    if (!drag) return;
    const dx = drag.current.x - drag.start.x, dy = drag.current.y - drag.start.y;
    if (commit && Math.hypot(dx, dy) >= 0.5) this.hooks.send({ type: 'move', ids: drag.ids, dx, dy });
    this.blockedPose = 'fist';
  }
  private beginShapeTransform(point: Point, settings: Settings): boolean {
    const state = this.hooks.getState(), selected = currentObjects(state.history).filter(object => state.selection.includes(object.id));
    if (selected.length !== 1 || ['text', 'connector'].includes(selected[0].type)) return false;
    const handle = nearestShapeHandle(shapeHandles(selected[0], settings.shapeEditMode, settings.shapeResizeMode), point);
    if (!handle) return false;
    this.hooks.endPinch();
    this.shapeTransform = { baseline: selected[0], handle, preview: selected[0] };
    this.visuals.objectPreview = selected[0]; this.hooks.previewObject?.(selected[0]);
    this.diagnostics.interaction = 'shape-transform'; this.hooks.showPointer(point, 22, true, 'S'); return true;
  }
  private endShapeTransform(commit: boolean): void {
    const transform = this.shapeTransform; this.shapeTransform = null; this.visuals.objectPreview = null; this.hooks.previewObject?.(null);
    this.diagnostics.interaction = 'hover';
    if (commit && transform && JSON.stringify(transform.baseline) !== JSON.stringify(transform.preview)) this.hooks.send({ type: 'update-object', object: transform.preview });
  }
  cancelActive(): void {
    this.cancelSpatial();
    this.endShapeTransform(false); this.endDrag(false); this.endErase(); this.cancelLasso(); this.hooks.endPinch(); this.gesture.reset(); this.pen.reset(); this.pose.reset(); this.palmFilter.reset(); this.fistFilter.reset(); this.lastDominant = null; this.blockedPose = null; this.lassoCandidateAt = null; this.lassoGestureLatched = false; this.lassoBlocked = false;
    this.pointer = null;
    Object.assign(this.diagnostics, { instantaneousGesture: 'neutral', stableGesture: 'neutral', gestureEnterMs: 0, interaction: 'hover', rawPoint: null, mappedPoint: null, virtualNibPoint: null, grabbedStrokeId: null, penDown: false, fourFingertipConfidence: 0 });
  }
  private syncReactionDiagnostics(): void { Object.assign(this.diagnostics, { reactionState: this.reaction.state, reactionGesture: this.reaction.gesture, reactionConfidence: this.reaction.confidence }); }
  private cancelCalibrations(): void {
    this.planeCapture = null; this.visuals.planeCaptured = []; this.visuals.planeTarget = null; this.diagnostics.planeCalibrationActive = false;
    this.stylusCapture = false; this.visuals.stylusTarget = false;
  }
  reset(): void { this.cancelActive(); this.cancelCalibrations(); this.twoHand.reset(); this.reaction.trackingLost(); this.syncReactionDiagnostics(); Object.assign(this.diagnostics, { twoHandClose: false, twoHandHeldMs: 0 }); }
}
