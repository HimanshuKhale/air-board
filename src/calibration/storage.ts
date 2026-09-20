import type { Point, Settings } from '../core/types';
import { homographyFromQuad } from './homography';
export const HAND_SETTINGS_KEY = 'saai-airboard-hand-settings-v2';
type Stored = Pick<Settings, 'dominantHand' | 'gestureSensitivity' | 'inputMode' | 'stylusOffset' | 'penGripHoldMs' | 'openPalmHoldMs' | 'palmEraserSize' | 'planePoints' | 'lassoCloseRadius' | 'lassoGesture' | 'lassoHoldMs' | 'fistGrabRadius' | 'twoHandHoldMs' | 'twoHandProximity' | 'smartShapes' | 'autoConvertShapes' | 'recognitionMode' | 'confirmationHoldMs' | 'shapeEditMode' | 'shapeResizeMode' | 'reactionsEnabled' | 'reactionSlots' | 'reactionIntensity' | 'reactionDurationMs' | 'spatialTransformHoldMs' | 'spatialScaleGain' | 'spatialSmoothing' | 'spatialScaleDeadZone' | 'spatialRotationDeadZoneDeg'>;
export function loadHandSettings(base: Settings): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(HAND_SETTINGS_KEY) ?? '{}') as Partial<Stored>;
    if (value.dominantHand === 'Left' || value.dominantHand === 'Right') base.dominantHand = value.dominantHand;
    if (['gentle', 'balanced', 'responsive'].includes(String(value.gestureSensitivity))) base.gestureSensitivity = value.gestureSensitivity!;
    if (value.inputMode === 'finger' || value.inputMode === 'pen') base.inputMode = value.inputMode;
    if (value.stylusOffset && Number.isFinite(value.stylusOffset.x) && Number.isFinite(value.stylusOffset.y) && Math.abs(value.stylusOffset.x) <= 1 && Math.abs(value.stylusOffset.y) <= 1) base.stylusOffset = { ...value.stylusOffset };
    if (typeof value.penGripHoldMs === 'number' && value.penGripHoldMs >= 120 && value.penGripHoldMs <= 400) base.penGripHoldMs = value.penGripHoldMs;
    if (typeof value.openPalmHoldMs === 'number' && value.openPalmHoldMs >= 150 && value.openPalmHoldMs <= 250) base.openPalmHoldMs = value.openPalmHoldMs;
    if (typeof value.palmEraserSize === 'number' && value.palmEraserSize >= 30 && value.palmEraserSize <= 160) base.palmEraserSize = value.palmEraserSize;
    if (typeof value.lassoCloseRadius === 'number' && value.lassoCloseRadius >= 25 && value.lassoCloseRadius <= 120) base.lassoCloseRadius = value.lassoCloseRadius;
    if (value.lassoGesture === 'four-fingertip' || value.lassoGesture === 'index-only') base.lassoGesture = value.lassoGesture;
    if (typeof value.lassoHoldMs === 'number' && value.lassoHoldMs >= 150 && value.lassoHoldMs <= 400) base.lassoHoldMs = value.lassoHoldMs;
    if (typeof value.fistGrabRadius === 'number' && value.fistGrabRadius >= 25 && value.fistGrabRadius <= 160) base.fistGrabRadius = value.fistGrabRadius;
    if (typeof value.twoHandHoldMs === 'number' && value.twoHandHoldMs >= 400 && value.twoHandHoldMs <= 600) base.twoHandHoldMs = value.twoHandHoldMs;
    if (typeof value.twoHandProximity === 'number' && value.twoHandProximity >= .08 && value.twoHandProximity <= .5) base.twoHandProximity = value.twoHandProximity;
    if (validStoredPoints(value.planePoints)) base.planePoints = value.planePoints;
    if (typeof value.smartShapes === 'boolean') base.smartShapes = value.smartShapes;
    if (typeof value.autoConvertShapes === 'boolean') base.autoConvertShapes = value.autoConvertShapes;
    if (value.recognitionMode === 'shapes' || value.recognitionMode === 'digits' || value.recognitionMode === 'mixed') base.recognitionMode = value.recognitionMode;
    if (typeof value.confirmationHoldMs === 'number' && value.confirmationHoldMs >= 300 && value.confirmationHoldMs <= 500) base.confirmationHoldMs = value.confirmationHoldMs;
    if (value.shapeEditMode === 'scale' || value.shapeEditMode === 'points') base.shapeEditMode = value.shapeEditMode;
    if (value.shapeResizeMode === 'proportional' || value.shapeResizeMode === 'free') base.shapeResizeMode = value.shapeResizeMode;
    if (typeof value.reactionsEnabled === 'boolean') base.reactionsEnabled = value.reactionsEnabled;
    if (validReactionSlots(value.reactionSlots)) base.reactionSlots = value.reactionSlots.map(slot => ({ ...slot }));
    if (value.reactionIntensity === 'subtle' || value.reactionIntensity === 'normal') base.reactionIntensity = value.reactionIntensity;
    if (typeof value.reactionDurationMs === 'number' && value.reactionDurationMs >= 1500 && value.reactionDurationMs <= 4000) base.reactionDurationMs = value.reactionDurationMs;
    if (typeof value.spatialTransformHoldMs === 'number' && value.spatialTransformHoldMs >= 150 && value.spatialTransformHoldMs <= 500) base.spatialTransformHoldMs = value.spatialTransformHoldMs;
    if (typeof value.spatialScaleGain === 'number' && value.spatialScaleGain >= .5 && value.spatialScaleGain <= 3) base.spatialScaleGain = value.spatialScaleGain;
    if (typeof value.spatialSmoothing === 'number' && value.spatialSmoothing >= .1 && value.spatialSmoothing <= .8) base.spatialSmoothing = value.spatialSmoothing;
    if (typeof value.spatialScaleDeadZone === 'number' && value.spatialScaleDeadZone >= .01 && value.spatialScaleDeadZone <= .12) base.spatialScaleDeadZone = value.spatialScaleDeadZone;
    if (typeof value.spatialRotationDeadZoneDeg === 'number' && value.spatialRotationDeadZoneDeg >= 1 && value.spatialRotationDeadZoneDeg <= 12) base.spatialRotationDeadZoneDeg = value.spatialRotationDeadZoneDeg;
  } catch { /* Corrupt local preferences fall back to safe defaults. */ }
  return base;
}
const validStoredPoints = (value: unknown): value is Point[] | null => {
  if (value === null) return true;
  if (!Array.isArray(value) || value.length !== 4 || !value.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return false;
  try { homographyFromQuad(value as Point[]); return true; } catch { return false; }
};
const validReactionSlots = (value: unknown): value is Settings['reactionSlots'] => Array.isArray(value) && value.length === 4 && value.every(slot => slot &&
  ['thumbs-up', 'finger-heart', 'v-sign', 'shaka'].includes(String(slot.gesture)) && ['👍', '❤️', '🎉', '🤙', '👏', '⭐'].includes(String(slot.emoji)) && typeof slot.enabled === 'boolean') && new Set(value.map(slot => slot.gesture)).size === 4;
export function saveHandSettings(settings: Settings): void {
  const value: Stored = { dominantHand: settings.dominantHand, gestureSensitivity: settings.gestureSensitivity, inputMode: settings.inputMode, stylusOffset: settings.stylusOffset, penGripHoldMs: settings.penGripHoldMs, openPalmHoldMs: settings.openPalmHoldMs,
    palmEraserSize: settings.palmEraserSize, planePoints: settings.planePoints, lassoCloseRadius: settings.lassoCloseRadius, lassoGesture: settings.lassoGesture, lassoHoldMs: settings.lassoHoldMs, fistGrabRadius: settings.fistGrabRadius,
    twoHandHoldMs: settings.twoHandHoldMs, twoHandProximity: settings.twoHandProximity, smartShapes: settings.smartShapes, autoConvertShapes: settings.autoConvertShapes, recognitionMode: settings.recognitionMode,
    confirmationHoldMs: settings.confirmationHoldMs, shapeEditMode: settings.shapeEditMode, shapeResizeMode: settings.shapeResizeMode,
    reactionsEnabled: settings.reactionsEnabled, reactionSlots: settings.reactionSlots.map(slot => ({ ...slot })), reactionIntensity: settings.reactionIntensity, reactionDurationMs: settings.reactionDurationMs,
    spatialTransformHoldMs: settings.spatialTransformHoldMs, spatialScaleGain: settings.spatialScaleGain, spatialSmoothing: settings.spatialSmoothing, spatialScaleDeadZone: settings.spatialScaleDeadZone, spatialRotationDeadZoneDeg: settings.spatialRotationDeadZoneDeg };
  try { localStorage.setItem(HAND_SETTINGS_KEY, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ }
}
