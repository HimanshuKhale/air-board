/**
 * SAAI AirBoard - Unified Hand Tracker Coordinator
 *
 * Coordinates video streaming, MediaPipe landmarker inference,
 * coordinate transformation, pinch detection, and pointer smoothing.
 * Emits generic HandPointerEvent objects decoupled from UI or drawing engines.
 */

import { CalibrationConfig, HandPointerEvent, PerformanceMetrics, Point2D } from '../types';
import { CoordinateTransformer } from './coordinateTransformer';
import { HandLandmarkerService } from './handLandmarkerService';
import { PinchDetector } from './pinchDetector';
import { PointerFilter } from './pointerFilter';

export type PointerListener = (event: HandPointerEvent) => void;
export type MetricsListener = (metrics: PerformanceMetrics) => void;
export type StatusListener = (status: { isStreaming: boolean; isModelReady: boolean; error: string | null }) => void;

export class HandTracker {
  private videoElement: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private landmarkerService = new HandLandmarkerService();
  private pinchDetector = new PinchDetector();
  private pointerFilter = new PointerFilter();
  private transformer: CoordinateTransformer;

  private isRunning = false;
  private animationFrameId: number | null = null;
  private lastInferenceTime = 0;
  private targetFps = 30;

  // Performance tracking
  private inferenceCount = 0;
  private lastFpsCalcTime = performance.now();
  private currentInferenceFps = 0;
  private lastInferenceDuration = 0;
  private handDetected = false;

  private pointerListeners: Set<PointerListener> = new Set();
  private metricsListeners: Set<MetricsListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  private lastWasPinching = false;
  private wasHandPresent = false;

  constructor(viewportWidth = 1920, viewportHeight = 1080) {
    this.transformer = new CoordinateTransformer({
      mirror: true,
      viewportWidth,
      viewportHeight,
    });
  }

  async initModel(wasmPath = '/wasm', modelPath = '/models/hand_landmarker.task'): Promise<boolean> {
    const success = await this.landmarkerService.init(wasmPath, modelPath);
    this.notifyStatus();
    return success;
  }

  updateDimensions(viewportWidth: number, viewportHeight: number, canvasWidth?: number, canvasHeight?: number): void {
    this.transformer.updateDimensions(viewportWidth, viewportHeight, canvasWidth, canvasHeight);
  }

  applyCalibration(config: Partial<CalibrationConfig>): void {
    if (config.pinchThreshold !== undefined || config.releaseThreshold !== undefined) {
      this.pinchDetector.updateConfig({
        pinchThreshold: config.pinchThreshold,
        releaseThreshold: config.releaseThreshold,
      });
    }

    if (
      config.smoothingFactor !== undefined ||
      config.useOneEuroFilter !== undefined ||
      config.oneEuroMinCutoff !== undefined ||
      config.oneEuroBeta !== undefined ||
      config.oneEuroDCutoff !== undefined
    ) {
      this.pointerFilter.updateOptions({
        useOneEuro: config.useOneEuroFilter ?? true,
        emaAlpha: config.smoothingFactor ?? 0.45,
        oneEuroMinCutoff: config.oneEuroMinCutoff ?? 1.2,
        oneEuroBeta: config.oneEuroBeta ?? 0.015,
        oneEuroDCutoff: config.oneEuroDCutoff ?? 1.0,
      });
    }

    if (config.mirrorInput !== undefined) {
      this.transformer.setMirror(config.mirrorInput);
    }

    if (config.targetFps !== undefined) {
      this.targetFps = Math.max(15, Math.min(60, config.targetFps));
    }
  }

  async startCamera(deviceId?: string): Promise<boolean> {
    this.stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;

      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;
      }

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.isRunning = true;
      this.startTrackingLoop();
      this.notifyStatus();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Camera access error:', err);
      this.notifyStatus(msg);
      return false;
    }
  }

  stopCamera(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    // Reset filters and gesture states
    this.pointerFilter.reset();
    this.pinchDetector.reset();

    if (this.lastWasPinching) {
      this.emitPointerUp();
    }

    this.lastWasPinching = false;
    this.wasHandPresent = false;
    this.handDetected = false;
    this.notifyStatus();
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  isCameraStreaming(): boolean {
    return this.isRunning && !!this.mediaStream && this.mediaStream.active;
  }

  isReady(): boolean {
    return this.landmarkerService.isModelReady();
  }

  private startTrackingLoop(): void {
    const loop = (now: number) => {
      if (!this.isRunning) return;

      const minInterval = 1000 / this.targetFps;
      const elapsed = now - this.lastInferenceTime;

      if (elapsed >= minInterval && this.videoElement && this.landmarkerService.isModelReady()) {
        this.lastInferenceTime = now;
        this.processFrame(now);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private processFrame(timestamp: number): void {
    if (!this.videoElement) return;

    const output = this.landmarkerService.detectForVideo(this.videoElement, timestamp);
    if (!output) return;

    this.inferenceCount++;
    this.lastInferenceDuration = output.inferenceDurationMs;

    // Update FPS calculation every 1000ms
    const now = performance.now();
    if (now - this.lastFpsCalcTime >= 1000) {
      this.currentInferenceFps = Math.round((this.inferenceCount * 1000) / (now - this.lastFpsCalcTime));
      this.inferenceCount = 0;
      this.lastFpsCalcTime = now;
      this.emitMetrics();
    }

    const landmarks = output.landmarks;
    const hasHand = !!landmarks && landmarks.length >= 21;
    this.handDetected = hasHand;

    // Hand tracking lost handling
    if (!hasHand) {
      if (this.wasHandPresent && this.lastWasPinching) {
        // GESTURE SAFETY: Loss of hand tracking must immediately terminate current stroke
        this.emitPointerUp();
      }
      this.pointerFilter.reset();
      this.pinchDetector.reset();
      this.wasHandPresent = false;
      this.lastWasPinching = false;
      return;
    }

    // Hand reacquired: reset filter so no long accidental line is connected!
    if (!this.wasHandPresent) {
      this.pointerFilter.reset();
      this.pinchDetector.reset();
      this.wasHandPresent = true;
    }

    // Process pinch
    const pinchState = this.pinchDetector.processLandmarks(landmarks, output.confidence);

    // Raw index fingertip (Landmark 8) in camera normalized space (0..1)
    const rawIndexPoint: Point2D = {
      x: landmarks[8].x,
      y: landmarks[8].y,
      time: timestamp,
    };

    // Smooth raw normalized coordinate
    const smoothedNormalized = this.pointerFilter.filter(rawIndexPoint, timestamp);

    // Transform smoothed normalized coordinates to canvas space
    const canvasPoint = this.transformer.toCanvasPixels(smoothedNormalized);

    // Determine pointer event type
    let eventType: 'move' | 'down' | 'up' = 'move';

    if (pinchState.phase === 'start') {
      eventType = 'down';
      this.lastWasPinching = true;
    } else if (pinchState.phase === 'hold') {
      eventType = this.lastWasPinching ? 'move' : 'down';
      this.lastWasPinching = true;
    } else if (pinchState.phase === 'end') {
      eventType = 'up';
      this.lastWasPinching = false;
    } else {
      // idle
      if (this.lastWasPinching) {
        eventType = 'up';
      }
      this.lastWasPinching = false;
    }

    const event: HandPointerEvent = {
      type: eventType,
      point: canvasPoint,
      rawNormalized: rawIndexPoint,
      smoothedNormalized,
      isPinching: pinchState.isPinching,
      pinchPhase: pinchState.phase,
      normalizedDistance: pinchState.normalizedDistance,
      handDetected: true,
      landmarks,
    };

    this.pointerListeners.forEach((listener) => listener(event));
  }

  private emitPointerUp(): void {
    const lastSmoothed = this.pointerFilter.getLastSmoothed() || { x: 0.5, y: 0.5 };
    const canvasPoint = this.transformer.toCanvasPixels(lastSmoothed);
    const event: HandPointerEvent = {
      type: 'up',
      point: canvasPoint,
      rawNormalized: lastSmoothed,
      smoothedNormalized: lastSmoothed,
      isPinching: false,
      pinchPhase: 'end',
      normalizedDistance: 1.0,
      handDetected: false,
    };
    this.pointerListeners.forEach((listener) => listener(event));
  }

  private emitMetrics(): void {
    const metrics: PerformanceMetrics = {
      inferenceFps: this.currentInferenceFps,
      renderFps: 60, // measured in render loop
      inferenceDurationMs: Math.round(this.lastInferenceDuration * 10) / 10,
      isModelReady: this.landmarkerService.isModelReady(),
      handDetected: this.handDetected,
      activeHandCount: this.handDetected ? 1 : 0,
    };
    this.metricsListeners.forEach((listener) => listener(metrics));
  }

  private notifyStatus(error: string | null = null): void {
    const status = {
      isStreaming: this.isCameraStreaming(),
      isModelReady: this.landmarkerService.isModelReady(),
      error: error || this.landmarkerService.getError(),
    };
    this.statusListeners.forEach((listener) => listener(status));
  }

  // Event subscription methods
  onPointer(listener: PointerListener): () => void {
    this.pointerListeners.add(listener);
    return () => this.pointerListeners.delete(listener);
  }

  onMetrics(listener: MetricsListener): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  destroy(): void {
    this.stopCamera();
    this.landmarkerService.close();
    this.pointerListeners.clear();
    this.metricsListeners.clear();
    this.statusListeners.clear();
  }
}
