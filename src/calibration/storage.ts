import type { Point, Settings } from '../core/types';
import { homographyFromQuad } from './homography';
export const HAND_SETTINGS_KEY = 'saai-airboard-hand-settings-v1';
type Stored = Pick<Settings, 'dominantHand' | 'gestureSensitivity' | 'inputMode' | 'stylusOffset' | 'openPalmHoldMs' | 'palmEraserSize' | 'planePoints' | 'lassoCloseRadius' | 'fistGrabRadius' | 'twoHandHoldMs' | 'twoHandProximity'>;
export function loadHandSettings(base: Settings): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(HAND_SETTINGS_KEY) ?? '{}') as Partial<Stored>;
    if (value.dominantHand === 'Left' || value.dominantHand === 'Right') base.dominantHand = value.dominantHand;
    if (['gentle', 'balanced', 'responsive'].includes(String(value.gestureSensitivity))) base.gestureSensitivity = value.gestureSensitivity!;
    if (value.inputMode === 'finger' || value.inputMode === 'stylus') base.inputMode = value.inputMode;
    if (value.stylusOffset && Number.isFinite(value.stylusOffset.x) && Number.isFinite(value.stylusOffset.y) && Math.abs(value.stylusOffset.x) <= 1 && Math.abs(value.stylusOffset.y) <= 1) base.stylusOffset = { ...value.stylusOffset };
    if (typeof value.openPalmHoldMs === 'number' && value.openPalmHoldMs >= 150 && value.openPalmHoldMs <= 250) base.openPalmHoldMs = value.openPalmHoldMs;
    if (typeof value.palmEraserSize === 'number' && value.palmEraserSize >= 30 && value.palmEraserSize <= 160) base.palmEraserSize = value.palmEraserSize;
    if (typeof value.lassoCloseRadius === 'number' && value.lassoCloseRadius >= 25 && value.lassoCloseRadius <= 120) base.lassoCloseRadius = value.lassoCloseRadius;
    if (typeof value.fistGrabRadius === 'number' && value.fistGrabRadius >= 25 && value.fistGrabRadius <= 160) base.fistGrabRadius = value.fistGrabRadius;
    if (typeof value.twoHandHoldMs === 'number' && value.twoHandHoldMs >= 400 && value.twoHandHoldMs <= 600) base.twoHandHoldMs = value.twoHandHoldMs;
    if (typeof value.twoHandProximity === 'number' && value.twoHandProximity >= .08 && value.twoHandProximity <= .5) base.twoHandProximity = value.twoHandProximity;
    if (validStoredPoints(value.planePoints)) base.planePoints = value.planePoints;
  } catch { /* Corrupt local preferences fall back to safe defaults. */ }
  return base;
}
const validStoredPoints = (value: unknown): value is Point[] | null => {
  if (value === null) return true;
  if (!Array.isArray(value) || value.length !== 4 || !value.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return false;
  try { homographyFromQuad(value as Point[]); return true; } catch { return false; }
};
export function saveHandSettings(settings: Settings): void {
  const value: Stored = { dominantHand: settings.dominantHand, gestureSensitivity: settings.gestureSensitivity, inputMode: settings.inputMode, stylusOffset: settings.stylusOffset, openPalmHoldMs: settings.openPalmHoldMs,
    palmEraserSize: settings.palmEraserSize, planePoints: settings.planePoints, lassoCloseRadius: settings.lassoCloseRadius, fistGrabRadius: settings.fistGrabRadius,
    twoHandHoldMs: settings.twoHandHoldMs, twoHandProximity: settings.twoHandProximity };
  try { localStorage.setItem(HAND_SETTINGS_KEY, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ }
}
