import type { BoardState, Brush, Point, Settings, Size } from '../core/types';
import type { Command } from '../sync/protocol';
import type { TrackingResult } from '../tracking/protocol';
import { GestureController } from '../input/gesture';
import type { HandPointer } from '../input/gesture';
import type { PinchPhase } from '../input/pinch';
import { ExponentialFilter } from '../input/filter';
import { anatomicalHandedness, classifyConfirmationPose, classifyPose, palmCenter, type ConfirmationPose, type StaticGesture } from './pose';
import { PoseStabilizer } from './temporal';
import { currentObjects, currentStrokes } from '../drawing/history';
import { nearestObject, selectObjects } from '../drawing/objects';
import { bounds, nearestStroke, pathLength, selectStrokes, validLasso } from '../selection/geometry';
import type { MovePreview } from '../drawing/history';
import { TwoHandToggle } from './two-hand';
import { applyStylusOffset, calibrateStylusOffset, virtualNib } from './stylus';
import { homographyFromQuad } from '../calibration/homography';
import { nearestShapeHandle, shapeHandles, transformObject, type ShapeHandle } from '../drawing/transform';
import type { BoardObject } from '../core/types';

export type InteractionMode = 'hover' | 'write' | 'erase' | 'lasso' | 'drag' | 'shape-transform' | 'plane-calibration' | 'stylus-calibration';
export interface InteractionDiagnostics {
  dominantHand: 'Left' | 'Right'; detectedHands: string[]; instantaneousGesture: StaticGesture;
  stableGesture: StaticGesture; gestureEnterMs: number; interaction: InteractionMode;
  handControl: 'enabled' | 'paused'; rawPoint: Point | null; mappedPoint: Point | null;
  lassoActive: boolean; selectedStrokeCount: number; grabbedStrokeId: string | null; planeCalibrationActive: boolean; planeCalibrationValid: boolean;
  inputMode: Settings['inputMode']; virtualNibPoint: Point | null; twoHandClose: boolean; twoHandHeldMs: number;
  confirmationGesture: ConfirmationPose; confirmationConfidence: number;
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
  confirmationPending?(): boolean;
  confirmationPose?(pose: ConfirmationPose, confidence: number, now: number): void;
  confirmationInterrupted?(): void;
}
export interface InteractionVisuals { lasso: Point[]; lassoStart: Point | null; planeTarget: number | null; planeCaptured: Point[]; movePreview: MovePreview | null; objectPreview: BoardObject | null; stylusTarget: boolean }

export class InteractionController {
  pointer: HandPointer | null = null;
  readonly diagnostics: InteractionDiagnostics = {
    dominantHand: 'Right', detectedHands: [], instantaneousGesture: 'neutral', stableGesture: 'neutral', gestureEnterMs: 0,
    interaction: 'hover', handControl: 'enabled', rawPoint: null, mappedPoint: null,
    lassoActive: false, selectedStrokeCount: 0, grabbedStrokeId: null, planeCalibrationActive: false, planeCalibrationValid: false,
    inputMode: 'finger', virtualNibPoint: null, twoHandClose: false, twoHandHeldMs: 0, confirmationGesture: 'neutral', confirmationConfidence: 0,
  };
  readonly visuals: InteractionVisuals = { lasso: [], lassoStart: null, planeTarget: null, planeCaptured: [], movePreview: null, objectPreview: null, stylusTarget: false };
  private gesture = new GestureController();
  private pose = new PoseStabilizer();
  private twoHand = new TwoHandToggle();
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
  constructor(private hooks: InteractionHooks) {}
  update(result: TrackingResult, size: Size, now: number, settings: Settings): void {
    this.diagnostics.dominantHand = settings.dominantHand;
    this.diagnostics.handControl = settings.paused ? 'paused' : 'enabled';
    this.diagnostics.inputMode = settings.inputMode;
    this.diagnostics.selectedStrokeCount = this.hooks.getState().selection.length;
    this.diagnostics.planeCalibrationValid = !!settings.planePoints;
    const hands = result.allLandmarks.map((landmarks, index) => ({ landmarks, categories: result.stats.handedness[index] ?? [], name: anatomicalHandedness(result.stats.handedness[index] ?? [], false, .7) }));
    this.diagnostics.detectedHands = hands.map(hand => hand.name ? `${hand.name} ${(hand.categories[0]?.score ?? 0).toFixed(2)}` : 'Unknown');
    const confirmationPending = this.hooks.confirmationPending?.() ?? false;
    if (confirmationPending) {
      const left = hands.find(hand => hand.name === 'Left' && hand.landmarks.length === 21);
      const confirmation = left ? classifyConfirmationPose(left.landmarks, size) : { gesture: 'neutral' as const, confidence: 0 };
      this.diagnostics.confirmationGesture = confirmation.gesture; this.diagnostics.confirmationConfidence = confirmation.confidence;
      if (left) this.hooks.confirmationPose?.(confirmation.gesture, confirmation.confidence, now); else this.hooks.confirmationInterrupted?.();
      this.twoHand.reset();
    } else {
      this.diagnostics.confirmationGesture = 'neutral'; this.diagnostics.confirmationConfidence = 0;
    }
    const toggleHandControl = confirmationPending ? false : this.twoHand.update(hands.map(hand => hand.landmarks), size, now, settings.twoHandHoldMs, settings.twoHandProximity);
    this.diagnostics.twoHandClose = this.twoHand.state.close; this.diagnostics.twoHandHeldMs = this.twoHand.state.heldMs;
    if (toggleHandControl) {
      this.cancelActive(); this.cancelCalibrations();
      const paused = !settings.paused;
      this.hooks.send({ type: 'settings', patch: { paused } });
      this.diagnostics.handControl = paused ? 'paused' : 'enabled';
      this.hooks.toast(paused ? 'Hand Control Paused. Mouse and touch remain available.' : 'Hand Control Enabled.');
      return;
    }
    if (settings.paused) { this.cancelActive(); this.diagnostics.handControl = 'paused'; return; }
    const activeHand = confirmationPending ? 'Right' : settings.dominantHand;
    const dominant = hands.find(hand => hand.name === activeHand && hand.landmarks.length === 21);
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
    const nib = settings.inputMode === 'stylus' ? virtualNib(dominant.landmarks, size) : null;
    this.diagnostics.virtualNibPoint = nib;
    const pointer = this.gesture.update(dominant.landmarks, size, now, { ...settings, paused: false }, nib ?? undefined);
    this.pointer = pointer;
    if (!pointer) { this.cancelActive(); return; }
    const raw = pointer.raw;
    const baseMapped = this.hooks.map(pointer.smooth, size, settings);
    const mapped = settings.inputMode === 'stylus' ? applyStylusOffset(baseMapped, settings.stylusOffset) : baseMapped;
    this.diagnostics.rawPoint = raw; this.diagnostics.mappedPoint = mapped;
    if (this.planeCapture) {
      this.capturePlanePoint(pointer.smooth, pointer.phase); this.diagnostics.interaction = 'plane-calibration';
      this.hooks.showPointer(mapped, 18, pointer.phase === 'pinchStart' || pointer.phase === 'pinchHold', String(this.planeCapture.length + 1));
      return;
    }
    if (this.stylusCapture) {
      this.diagnostics.interaction = 'stylus-calibration';
      this.hooks.showPointer(mapped, 18, pointer.phase === 'pinchStart' || pointer.phase === 'pinchHold', 'S');
      if (pointer.phase === 'pinchStart') {
        const stylusOffset = calibrateStylusOffset(baseMapped);
        this.hooks.send({ type: 'settings', patch: { stylusOffset } });
        this.stylusCapture = false; this.visuals.stylusTarget = false;
        this.hooks.toast('Stylus Assist offset calibrated and saved locally.');
      }
      return;
    }
    if (this.shapeTransform) {
      if (pointer.phase === 'pinchEnd' || pointer.phase === 'hover') this.endShapeTransform(pointer.phase === 'pinchEnd');
      else {
        const preview = transformObject(this.shapeTransform.baseline, this.shapeTransform.handle, mapped, settings.shapeResizeMode);
        if (preview) { this.shapeTransform.preview = preview; this.visuals.objectPreview = preview; this.hooks.previewObject?.(preview); }
        this.diagnostics.interaction = 'shape-transform'; this.hooks.showPointer(mapped, 22, true, 'S');
      }
      return;
    }
    if (pointer.phase === 'pinchStart' && this.beginShapeTransform(mapped, settings)) return;
    // Active lasso and eraser interactions retain ownership until their gesture is released.
    if (this.lasso.length) {
      if (classification.gesture !== 'index-only' || now - this.lassoAt > 8000) this.cancelLasso();
      else { this.continueLasso(mapped, now, settings); return; }
    }
    if (this.erasing) {
      if (classification.gesture !== 'open-palm') this.endErase();
      else { this.continueErase(dominant.landmarks, size, now, settings); return; }
    }
    if (stable.stable === 'open-palm' && classification.gesture === 'open-palm') {
      this.hooks.endPinch();
      this.beginErase(dominant.landmarks, size, now, settings); return;
    }
    if (stable.stable === 'index-only' && classification.gesture === 'index-only' && this.blockedPose !== 'index-only') {
      this.hooks.endPinch(); this.beginLasso(mapped, now); return;
    }
    if (stable.stable === 'fist' && classification.gesture === 'fist' && this.blockedPose !== 'fist') {
      this.hooks.endPinch(); this.beginDrag(dominant.landmarks, size, now, settings); return;
    }
    if (classification.gesture === 'index-only' || classification.gesture === 'fist') {
      this.hooks.endPinch(); this.diagnostics.interaction = 'hover';
      this.hooks.showPointer(mapped, 14, false, classification.gesture === 'fist' ? 'G' : 'L'); return;
    }
    this.diagnostics.interaction = pointer.phase === 'pinchStart' || pointer.phase === 'pinchHold' ? 'write' : 'hover';
    this.hooks.routePinch(mapped, pointer.phase);
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
    if (this.hooks.getState().settings.inputMode !== 'stylus') this.hooks.send({ type: 'settings', patch: { inputMode: 'stylus' } });
    this.stylusCapture = true; this.visuals.stylusTarget = true;
    this.hooks.toast('Hold your stylus naturally, align its tip to the center target, then pinch.');
  }
  resetStylusCalibration(): void {
    this.stylusCapture = false; this.visuals.stylusTarget = false;
    this.hooks.send({ type: 'settings', patch: { stylusOffset: { x: 0, y: 0 } } });
    this.hooks.toast('Stylus Assist offset reset.');
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
      this.blockedPose = 'index-only'; this.cancelLasso();
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
    this.endShapeTransform(false); this.endDrag(false); this.endErase(); this.cancelLasso(); this.hooks.endPinch(); this.gesture.reset(); this.pose.reset(); this.palmFilter.reset(); this.fistFilter.reset(); this.lastDominant = null; this.blockedPose = null;
    this.pointer = null;
    Object.assign(this.diagnostics, { instantaneousGesture: 'neutral', stableGesture: 'neutral', gestureEnterMs: 0, interaction: 'hover', rawPoint: null, mappedPoint: null, virtualNibPoint: null, grabbedStrokeId: null });
  }
  private cancelCalibrations(): void {
    this.planeCapture = null; this.visuals.planeCaptured = []; this.visuals.planeTarget = null; this.diagnostics.planeCalibrationActive = false;
    this.stylusCapture = false; this.visuals.stylusTarget = false;
  }
  reset(): void { this.cancelActive(); this.cancelCalibrations(); this.twoHand.reset(); Object.assign(this.diagnostics, { twoHandClose: false, twoHandHeldMs: 0 }); }
}
