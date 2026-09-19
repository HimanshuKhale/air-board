export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect extends Point, Size {}
export type Tool = 'pen' | 'highlighter' | 'eraser';
export type Fit = 'contain' | 'cover' | 'stretch';
export interface Brush { tool: Tool; color: string; size: number; opacity: number }
export interface Stroke { id: string; brush: Brush; points: Point[] }
export type ShapeKind = 'line' | 'square' | 'rectangle' | 'parallelogram' | 'trapezoid' | 'pentagon' | 'hexagon' | 'polygon' | 'circle' | 'ellipse' | 'triangle' | 'arrow' | 'text' | 'connector';
/** All geometry uses the fixed logical board. Lines and connectors may descend with flipY. */
export interface BoardObject {
  id: string; type: ShapeKind; x: number; y: number; width: number; height: number;
  color: string; strokeWidth: number; text: string; flipY?: boolean;
  fromId?: string; toId?: string;
  /** Absolute logical-board vertices preserve irregular polygons during free editing. */
  vertices?: Point[]; regular?: boolean;
}
export type DrawAction =
  | { kind: 'stroke'; stroke: Stroke }
  | { kind: 'clear' }
  | { kind: 'move'; ids: string[]; dx: number; dy: number }
  | { kind: 'create'; object: BoardObject }
  | { kind: 'update'; object: BoardObject }
  | { kind: 'delete'; id: string }
  | { kind: 'replace'; strokeId: string; object: BoardObject }
  | { kind: 'diagram'; objects: BoardObject[] };
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
  smartShapes: boolean; autoConvertShapes: boolean;
  confirmationHoldMs: number;
  shapeEditMode: 'scale' | 'points'; shapeResizeMode: 'proportional' | 'free';
}
export interface HistoryState { actions: DrawAction[]; position: number; active: Stroke | null }
export interface BoardState { settings: Settings; history: HistoryState; selection: string[] }
export const BOARD: Size = { width: 1600, height: 900 };
