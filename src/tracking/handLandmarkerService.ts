/**
 * SAAI AirBoard - Local MediaPipe Hand Landmarker Service
 *
 * Uses locally vendored model (/models/hand_landmarker.task) and WASM binaries (/wasm).
 * Completely offline, zero runtime CDN dependency.
 */

import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { NormalizedLandmark } from '../types';

export interface DetectionOutput {
  landmarks: NormalizedLandmark[] | null;
  confidence: number;
  handedness: 'Left' | 'Right' | null;
  inferenceDurationMs: number;
  timestamp: number;
}

export class HandLandmarkerService {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing = false;
  private isReady = false;
  private lastVideoTime = -1;
  private initError: string | null = null;

  async init(wasmPath = '/wasm', modelPath = '/models/hand_landmarker.task'): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load vision wasm binaries locally from public /wasm folder
      const vision = await FilesetResolver.forVisionTasks(wasmPath);

      // Attempt initialization with GPU acceleration first, fallback to CPU
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuError) {
        console.warn('GPU delegate failed in HandLandmarker, falling back to CPU:', gpuError);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to initialize HandLandmarker:', err);
      this.initError = msg;
      this.isInitializing = false;
      this.isReady = false;
      return false;
    }
  }

  isModelReady(): boolean {
    return this.isReady;
  }

  getError(): string | null {
    return this.initError;
  }

  detectForVideo(videoElement: HTMLVideoElement, timestamp: number): DetectionOutput | null {
    if (!this.handLandmarker || !this.isReady) {
      return null;
    }

    if (
      videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      return null;
    }

    // Performance optimization: Avoid redundant inference on the exact same video frame
    if (videoElement.currentTime === this.lastVideoTime) {
      return null;
    }
    this.lastVideoTime = videoElement.currentTime;

    const startTime = performance.now();
    let result: HandLandmarkerResult;

    try {
      result = this.handLandmarker.detectForVideo(videoElement, timestamp);
    } catch (err) {
      console.error('Hand detection inference error:', err);
      return null;
    }

    const inferenceDurationMs = performance.now() - startTime;

    if (!result.landmarks || result.landmarks.length === 0) {
      return {
        landmarks: null,
        confidence: 0,
        handedness: null,
        inferenceDurationMs,
        timestamp,
      };
    }

    const rawLandmarks = result.landmarks[0];
    const landmarks: NormalizedLandmark[] = rawLandmarks.map((l) => ({
      x: l.x,
      y: l.y,
      z: l.z,
    }));

    let handedness: 'Left' | 'Right' | null = null;
    let confidence = 0.8;

    if (result.handedness && result.handedness.length > 0 && result.handedness[0].length > 0) {
      const category = result.handedness[0][0];
      handedness = category.categoryName as 'Left' | 'Right';
      confidence = category.score ?? 0.8;
    }

    return {
      landmarks,
      confidence,
      handedness,
      inferenceDurationMs,
      timestamp,
    };
  }

  close(): void {
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch (err) {
        console.warn('Error closing HandLandmarker:', err);
      }
      this.handLandmarker = null;
    }
    this.isReady = false;
    this.isInitializing = false;
  }
}
