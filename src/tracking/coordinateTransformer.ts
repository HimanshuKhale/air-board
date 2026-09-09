/**
 * SAAI AirBoard - Coordinate Transformation Pipeline
 *
 * Maps normalized camera coordinates (0..1) through mirror orientation
 * to viewport pixels and internal high-DPI canvas coordinates.
 */

import { Point2D } from '../types';
import { clamp } from '../utils/math';

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface TransformationConfig {
  mirror: boolean;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export class CoordinateTransformer {
  private mirror: boolean;
  private viewportWidth: number;
  private viewportHeight: number;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(config: TransformationConfig) {
    this.mirror = config.mirror;
    this.viewportWidth = Math.max(1, config.viewportWidth);
    this.viewportHeight = Math.max(1, config.viewportHeight);
    this.canvasWidth = config.canvasWidth ?? this.viewportWidth;
    this.canvasHeight = config.canvasHeight ?? this.viewportHeight;
  }

  updateDimensions(viewportWidth: number, viewportHeight: number, canvasWidth?: number, canvasHeight?: number): void {
    this.viewportWidth = Math.max(1, viewportWidth);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.canvasWidth = canvasWidth ?? this.viewportWidth;
    this.canvasHeight = canvasHeight ?? this.viewportHeight;
  }

  setMirror(mirror: boolean): void {
    this.mirror = mirror;
  }

  isMirrored(): boolean {
    return this.mirror;
  }

  /**
   * Transforms normalized camera coordinate (0..1, 0..1)
   * to mirrored normalized space if mirror is active.
   */
  toNormalizedMirrored(cameraNorm: Point2D): Point2D {
    const clampedX = clamp(cameraNorm.x, 0, 1);
    const clampedY = clamp(cameraNorm.y, 0, 1);
    return {
      x: this.mirror ? 1.0 - clampedX : clampedX,
      y: clampedY,
      time: cameraNorm.time,
    };
  }

  /**
   * Transforms normalized camera coordinates (0..1, 0..1)
   * to screen / viewport pixel coordinates.
   */
  toViewportPixels(cameraNorm: Point2D): Point2D {
    const mirrored = this.toNormalizedMirrored(cameraNorm);
    return {
      x: mirrored.x * this.viewportWidth,
      y: mirrored.y * this.viewportHeight,
      time: cameraNorm.time,
    };
  }

  /**
   * Transforms normalized coordinates directly to drawing canvas pixel coordinates.
   */
  toCanvasPixels(cameraNorm: Point2D): Point2D {
    const mirrored = this.toNormalizedMirrored(cameraNorm);
    return {
      x: mirrored.x * this.canvasWidth,
      y: mirrored.y * this.canvasHeight,
      time: cameraNorm.time,
    };
  }

  /**
   * Transforms viewport pixel coordinates to canvas coordinate space.
   */
  viewportToCanvas(viewportPoint: Point2D): Point2D {
    const scaleX = this.canvasWidth / this.viewportWidth;
    const scaleY = this.canvasHeight / this.viewportHeight;
    return {
      x: viewportPoint.x * scaleX,
      y: viewportPoint.y * scaleY,
      time: viewportPoint.time,
    };
  }
}
