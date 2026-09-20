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
  color: string; strokeWidth: number; text: string; flipY?: boolean; rotation?: number;
  fromId?: string; toId?: string;
  /** Absolute logical-board vertices preserve irregular polygons during free editing. */
  vertices?: Point[]; regular?: boolean;
}
export type ReactionGesture = 'thumbs-up' | 'finger-heart' | 'v-sign' | 'shaka';
export type ReactionEmoji = '👍' | '❤️' | '🎉' | '🤙' | '👏' | '⭐';
export interface ReactionSlot { gesture: ReactionGesture; emoji: ReactionEmoji; enabled: boolean }
export interface ReactionEvent {
  id: string; type: ReactionGesture; emoji: ReactionEmoji; position: Point;
  createdAt: number; duration: number; intensity: 'subtle' | 'normal';
}
export interface CutLine { point: Point; direction: Point }
export type TransformMode = 'move' | 'scale' | 'rotate' | 'scale-rotate' | 'move-scale' | 'move-rotate' | 'move-scale-rotate';
export type DrawAction =
  | { kind: 'stroke'; stroke: Stroke }
  | { kind: 'clear' }
  | { kind: 'move'; ids: string[]; dx: number; dy: number }
  | { kind: 'create'; object: BoardObject }
  | { kind: 'update'; object: BoardObject }
  | { kind: 'delete'; id: string }
  | { kind: 'replace'; strokeId: string; object: BoardObject }
  | { kind: 'replace-many'; strokeIds: string[]; object: BoardObject }
  | { kind: 'diagram'; objects: BoardObject[] }
  | { kind: 'transform'; before: BoardObject[]; after: BoardObject[]; mode: TransformMode }
  | { kind: 'subdivide'; source: BoardObject; pieces: BoardObject[]; method: 'equal-length' | 'equal-area' | 'similar'; pieceCount: number }
  | { kind: 'cut'; source: BoardObject; pieces: [BoardObject, BoardObject]; line: CutLine };
export interface BackgroundSettings {
  mode: 'blank' | 'camera' | 'image'; color: string; image: string | null;
  fit: Fit; mirror: boolean; dim: number; positionX: number; positionY: number;
}
export interface Settings {
  brush: Brush; background: BackgroundSettings;
  smoothing: number; pinchClose: number; pinchOpen: number; debounceMs: number;
  paused: boolean; autoHide: boolean;
  dominantHand: 'Left' | 'Right'; gestureSensitivity: 'gentle' | 'balanced' | 'responsive';
  inputMode: 'finger' | 'pen'; stylusOffset: Point; penGripHoldMs: number;
  openPalmHoldMs: number; palmEraserSize: number;
  planePoints: Point[] | null; lassoCloseRadius: number;
  fistGrabRadius: number;
  twoHandHoldMs: number; twoHandProximity: number;
  smartShapes: boolean; autoConvertShapes: boolean;
  recognitionMode: 'shapes' | 'digits' | 'mixed';
  lassoGesture: 'four-fingertip' | 'index-only'; lassoHoldMs: number;
  confirmationHoldMs: number;
  shapeEditMode: 'scale' | 'points'; shapeResizeMode: 'proportional' | 'free';
  objectGestureMode: 'move' | 'move-scale' | 'move-rotate' | 'full' | 'cut';
  spatialTransformHoldMs: number; spatialScaleGain: number; spatialSmoothing: number;
  spatialScaleDeadZone: number; spatialRotationDeadZoneDeg: number;
  fistDepthNear: number; fistDepthFar: number;
  reactionsEnabled: boolean; reactionSlots: ReactionSlot[];
  reactionIntensity: 'subtle' | 'normal'; reactionDurationMs: number;
}
export interface HistoryState { actions: DrawAction[]; position: number; active: Stroke | null }
export interface BoardState { settings: Settings; history: HistoryState; selection: string[] }
export const BOARD: Size = { width: 1600, height: 900 };
