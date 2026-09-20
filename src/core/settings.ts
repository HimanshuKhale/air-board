import type { BoardState, Settings } from './types';
export const defaults = (): Settings => ({
  brush: { tool: 'pen', color: '#225c4a', size: 6, opacity: 1 },
  background: { mode: 'blank', color: '#ffffff', image: null, fit: 'contain', mirror: true, dim: 0.15, positionX: 0.5, positionY: 0.5 },
  smoothing: 0.6, pinchClose: 0.28, pinchOpen: 0.42, debounceMs: 65,
  paused: false, autoHide: true,
  dominantHand: 'Right', gestureSensitivity: 'balanced', openPalmHoldMs: 200, palmEraserSize: 72,
  inputMode: 'finger', stylusOffset: { x: 0, y: 0 }, penGripHoldMs: 180,
  planePoints: null, lassoCloseRadius: 55, fistGrabRadius: 70, twoHandHoldMs: 500, twoHandProximity: 0.22,
  smartShapes: true, autoConvertShapes: false, recognitionMode: 'shapes',
  lassoGesture: 'four-fingertip', lassoHoldMs: 220,
  confirmationHoldMs: 400, shapeEditMode: 'scale', shapeResizeMode: 'proportional',
  reactionsEnabled: true,
  reactionSlots: [
    { gesture: 'thumbs-up', emoji: '👍', enabled: true },
    { gesture: 'finger-heart', emoji: '❤️', enabled: false },
    { gesture: 'v-sign', emoji: '🎉', enabled: false },
    { gesture: 'shaka', emoji: '🤙', enabled: false },
  ],
  reactionIntensity: 'normal', reactionDurationMs: 2500,
});
export const initialState = (): BoardState => ({ settings: defaults(), history: { actions: [], position: 0, active: null }, selection: [] });
