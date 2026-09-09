/**
 * SAAI AirBoard - Core Types & Interfaces
 * Pure TypeScript domain definitions decoupled from UI frameworks.
 */

export type ToolType = 'pen' | 'highlighter' | 'eraser';

export interface Point2D {
  x: number;
  y: number;
  time?: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export type PinchPhase = 'idle' | 'start' | 'hold' | 'end';

export interface PinchState {
  isPinching: boolean;
  phase: PinchPhase;
  distance: number;          // Raw Euclidean distance
  normalizedDistance: number;// Hand-scale invariant distance
  confidence: number;
  rawPoint: Point2D;
  smoothedPoint: Point2D;
}

export interface HandPointerEvent {
  type: 'move' | 'down' | 'up';
  point: Point2D;            // Canvas coordinate
  rawNormalized: Point2D;    // Camera normalized (0..1)
  smoothedNormalized: Point2D;
  isPinching: boolean;
  pinchPhase: PinchPhase;
  normalizedDistance: number;
  handDetected: boolean;
  landmarks?: NormalizedLandmark[];
}

export interface StrokePoint extends Point2D {
  pressure?: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
  timestamp: number;
}

export type BackgroundMode = 'camera' | 'image' | 'blank';

export type BlankPreset = 'whiteboard' | 'blackboard' | 'custom';

export interface CameraBackgroundConfig {
  mirror: boolean;
  opacity: number; // 0.1 to 1.0
  blur: number;    // px, 0 to 20
  dim: number;     // 0.0 to 0.8 dark overlay
  fit: 'cover' | 'contain';
}

export interface ImageBackgroundConfig {
  dataUrl: string | null;
  fileName: string | null;
  fit: 'contain' | 'cover' | 'stretch';
  opacity: number;
}

export interface BlankBackgroundConfig {
  preset: BlankPreset;
  color: string;
  gridPattern?: 'none' | 'dots' | 'grid' | 'lines';
}

export interface BackgroundState {
  mode: BackgroundMode;
  camera: CameraBackgroundConfig;
  image: ImageBackgroundConfig;
  blank: BlankBackgroundConfig;
}

export interface CalibrationConfig {
  pinchThreshold: number;      // Distance below which pinch is triggered (e.g., 0.65 of reference)
  releaseThreshold: number;    // Distance above which pinch releases (e.g., 0.85 of reference)
  smoothingFactor: number;     // Exponential smoothing alpha (0.1 = heavy, 0.7 = snappy)
  useOneEuroFilter: boolean;   // Advanced jitter reduction filter
  oneEuroMinCutoff: number;    // One Euro filter min cutoff (Hz)
  oneEuroBeta: number;         // One Euro filter speed coefficient
  oneEuroDCutoff: number;      // Derivate cutoff
  mirrorInput: boolean;        // Mirror camera horizontally
  targetFps: number;           // Target inference FPS (e.g., 30)
}

export interface PerformanceMetrics {
  inferenceFps: number;
  renderFps: number;
  inferenceDurationMs: number;
  isModelReady: boolean;
  handDetected: boolean;
  activeHandCount: number;
}

export interface AirBoardState {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  background: BackgroundState;
  calibration: CalibrationConfig;
  isDebugOpen: boolean;
  isPresentationActive: boolean;
}

export type SyncMessage =
  | { type: 'STATE_SYNC'; payload: Partial<AirBoardState> }
  | { type: 'TOOL_CHANGE'; payload: { tool: ToolType } }
  | { type: 'COLOR_CHANGE'; payload: { color: string } }
  | { type: 'SIZE_CHANGE'; payload: { size: number } }
  | { type: 'BACKGROUND_CHANGE'; payload: BackgroundState }
  | { type: 'ACTION_UNDO' }
  | { type: 'ACTION_REDO' }
  | { type: 'ACTION_CLEAR' }
  | { type: 'REQUEST_FULL_SYNC' }
  | { type: 'FULL_SYNC_RESPONSE'; payload: AirBoardState };
