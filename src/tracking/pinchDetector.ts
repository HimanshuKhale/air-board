/**
 * SAAI AirBoard - Hand-Invariant Pinch Detector with Hysteresis State Machine
 *
 * Tracks Landmark 4 (thumb tip) and Landmark 8 (index tip).
 * Normalizes distance by palm scale (Landmark 0 to 9 - wrist to middle MCP)
 * to remain distance-invariant when presenter moves relative to camera.
 */

import { NormalizedLandmark, PinchPhase, PinchState, Point2D } from '../types';
import { clamp, distance2D } from '../utils/math';

export interface PinchConfig {
  pinchThreshold: number;   // Normalized ratio below which pinch begins (default ~0.35)
  releaseThreshold: number; // Normalized ratio above which pinch ends (default ~0.52)
  minTrackingConfidence: number; // Minimum confidence to accept detection (default 0.5)
}

export class PinchDetector {
  private isPinching = false;
  private phase: PinchPhase = 'idle';
  private pinchThreshold: number;
  private releaseThreshold: number;
  private minConfidence: number;
  private consecutivePinchFrames = 0;
  private consecutiveReleaseFrames = 0;
  private readonly DEBOUNCE_FRAMES = 1; // Snappy response with zero lag, hysteresis provides stability

  constructor(config?: Partial<PinchConfig>) {
    this.pinchThreshold = config?.pinchThreshold ?? 0.38;
    this.releaseThreshold = config?.releaseThreshold ?? 0.52;
    this.minConfidence = config?.minTrackingConfidence ?? 0.5;
  }

  updateConfig(config: Partial<PinchConfig>): void {
    if (config.pinchThreshold !== undefined) {
      this.pinchThreshold = config.pinchThreshold;
    }
    if (config.releaseThreshold !== undefined) {
      // Ensure release threshold is always strictly greater than pinch threshold
      this.releaseThreshold = Math.max(this.pinchThreshold + 0.05, config.releaseThreshold);
    }
    if (config.minTrackingConfidence !== undefined) {
      this.minConfidence = config.minTrackingConfidence;
    }
  }

  getConfig(): PinchConfig {
    return {
      pinchThreshold: this.pinchThreshold,
      releaseThreshold: this.releaseThreshold,
      minTrackingConfidence: this.minConfidence,
    };
  }

  /**
   * Evaluates hand landmarks and updates pinch state machine.
   *
   * @param landmarks Array of 21 hand landmarks from MediaPipe
   * @param confidence Overall tracking or presence confidence (0..1)
   */
  processLandmarks(landmarks: NormalizedLandmark[] | null | undefined, confidence = 1.0): PinchState {
    const defaultPoint: Point2D = { x: 0, y: 0 };

    if (!landmarks || landmarks.length < 21 || confidence < this.minConfidence) {
      const wasPinching = this.isPinching;
      this.isPinching = false;
      this.phase = wasPinching ? 'end' : 'idle';
      this.consecutivePinchFrames = 0;
      this.consecutiveReleaseFrames = 0;
      return {
        isPinching: false,
        phase: this.phase,
        distance: 1.0,
        normalizedDistance: 1.0,
        confidence: 0,
        rawPoint: defaultPoint,
        smoothedPoint: defaultPoint,
      };
    }

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    const middleMcp = landmarks[9]; // Rigid palm reference
    const indexMcp = landmarks[5];

    // Raw 2D distance between thumb tip and index tip
    const thumbPoint: Point2D = { x: thumbTip.x, y: thumbTip.y };
    const indexPoint: Point2D = { x: indexTip.x, y: indexTip.y };
    const rawPinchDistance = distance2D(thumbPoint, indexPoint);

    // Anatomical palm reference: distance between wrist (0) and middle MCP (9).
    // Fallback to wrist-to-index MCP (5) if needed.
    const wristPoint: Point2D = { x: wrist.x, y: wrist.y };
    const palmPoint: Point2D = { x: middleMcp.x, y: middleMcp.y };
    const handScale = Math.max(0.04, distance2D(wristPoint, palmPoint));

    // Distance normalized by hand scale
    const normalizedDistance = rawPinchDistance / handScale;

    // Hysteresis State Machine
    if (!this.isPinching) {
      if (normalizedDistance <= this.pinchThreshold) {
        this.consecutivePinchFrames++;
        if (this.consecutivePinchFrames >= this.DEBOUNCE_FRAMES) {
          this.isPinching = true;
          this.phase = 'start';
          this.consecutiveReleaseFrames = 0;
        } else {
          this.phase = 'idle';
        }
      } else {
        this.consecutivePinchFrames = 0;
        this.phase = 'idle';
      }
    } else {
      // Currently pinching: must exceed releaseThreshold to break pinch
      if (normalizedDistance >= this.releaseThreshold) {
        this.consecutiveReleaseFrames++;
        if (this.consecutiveReleaseFrames >= this.DEBOUNCE_FRAMES) {
          this.isPinching = false;
          this.phase = 'end';
          this.consecutivePinchFrames = 0;
        } else {
          this.phase = 'hold';
        }
      } else {
        this.consecutiveReleaseFrames = 0;
        this.phase = 'hold';
      }
    }

    return {
      isPinching: this.isPinching,
      phase: this.phase,
      distance: rawPinchDistance,
      normalizedDistance,
      confidence,
      rawPoint: indexPoint,
      smoothedPoint: indexPoint, // smoothed in pointer filter
    };
  }

  /**
   * Explicitly abort/reset pinch state (e.g. when tracking is lost or tool changes).
   */
  reset(): void {
    this.isPinching = false;
    this.phase = 'idle';
    this.consecutivePinchFrames = 0;
    this.consecutiveReleaseFrames = 0;
  }
}
