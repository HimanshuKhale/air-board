export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect extends Point, Size {}
export type Tool = 'pen' | 'highlighter' | 'eraser';
export type Fit = 'contain' | 'cover' | 'stretch';
export interface Brush { tool: Tool; color: string; size: number; opacity: number }
export interface Stroke { id: string; brush: Brush; points: Point[] }
export type DrawAction = { kind: 'stroke'; stroke: Stroke } | { kind: 'clear' } | { kind: 'move'; ids: string[]; dx: number; dy: number };
export interface BackgroundSettings {
  mode: 'blank' | 'camera' | 'image'; color: string; image: string | null;
  fit: Fit; mirror: boolean; dim: number; positionX: number; positionY: number;
}
export interface Settings {
  brush: Brush; background: BackgroundSettings;
  smoothing: number; pinchClose: number; pinchOpen: number; debounceMs: number;
  paused: boolean; autoHide: boolean;
  dominantHand: 'Left' | 'Right'; gestureSensitivity: 'gentle' | 'balanced' | 'responsive';
  inputMode: 'finger' | 'stylus'; stylusOffset: Point;
  openPalmHoldMs: number; palmEraserSize: number;
  planePoints: Point[] | null; lassoCloseRadius: number;
  fistGrabRadius: number;
  twoHandHoldMs: number; twoHandProximity: number;
}
export interface HistoryState { actions: DrawAction[]; position: number; active: Stroke | null }
export interface BoardState { settings: Settings; history: HistoryState; selection: string[] }
export const BOARD: Size = { width: 1600, height: 900 };
