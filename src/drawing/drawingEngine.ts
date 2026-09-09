/**
 * SAAI AirBoard - Drawing Engine
 *
 * Decoupled from tracking. Handles Pen, Highlighter, and Eraser
 * with quadratic bezier curve interpolation and destination-out pixel erasing.
 */

import { Point2D, Stroke, StrokePoint, ToolType } from '../types';
import { HistoryManager } from './historyManager';

export interface DrawingEngineOptions {
  canvas: HTMLCanvasElement;
  historyManager: HistoryManager;
  pixelRatio?: number;
}

export class DrawingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private historyManager: HistoryManager;
  private pixelRatio: number;

  private currentStroke: Stroke | null = null;
  private currentPoints: StrokePoint[] = [];

  constructor(options: DrawingEngineOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Failed to obtain 2D rendering context for canvas');
    }
    this.ctx = context;
    this.historyManager = options.historyManager;
    this.pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1;

    // Listen to undo/redo from history manager to repaint
    this.historyManager.onChange(() => {
      this.redrawAll();
    });
  }

  setCanvasSize(width: number, height: number, pixelRatio = window.devicePixelRatio ?? 1): void {
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.redrawAll();
  }

  startStroke(
    point: Point2D,
    tool: ToolType,
    color: string,
    size: number,
    opacity = 1.0
  ): void {
    const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const strokePoint: StrokePoint = { x: point.x, y: point.y };

    this.currentPoints = [strokePoint];
    this.currentStroke = {
      id: strokeId,
      tool,
      color,
      size,
      opacity: tool === 'highlighter' ? 0.35 : opacity,
      points: this.currentPoints,
      timestamp: Date.now(),
    };

    // Draw initial dot
    this.applyBrushStyle(this.ctx, tool, color, size, this.currentStroke.opacity);
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  continueStroke(point: Point2D): void {
    if (!this.currentStroke || this.currentPoints.length === 0) return;

    const prevPoint = this.currentPoints[this.currentPoints.length - 1];
    // Ignore near-identical points to save memory and avoid degenerate curves
    const dist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
    if (dist < 1.0) return;

    const strokePoint: StrokePoint = { x: point.x, y: point.y };
    this.currentPoints.push(strokePoint);

    // Incremental stroke rendering
    const points = this.currentPoints;
    const len = points.length;

    this.applyBrushStyle(
      this.ctx,
      this.currentStroke.tool,
      this.currentStroke.color,
      this.currentStroke.size,
      this.currentStroke.opacity
    );

    this.ctx.beginPath();
    if (len === 2) {
      this.ctx.moveTo(points[0].x, points[0].y);
      this.ctx.lineTo(points[1].x, points[1].y);
    } else {
      const p0 = points[len - 3];
      const p1 = points[len - 2];
      const p2 = points[len - 1];

      const startMidX = (p0.x + p1.x) / 2;
      const startMidY = (p0.y + p1.y) / 2;
      const endMidX = (p1.x + p2.x) / 2;
      const endMidY = (p1.y + p2.y) / 2;

      this.ctx.moveTo(startMidX, startMidY);
      this.ctx.quadraticCurveTo(p1.x, p1.y, endMidX, endMidY);
    }
    this.ctx.stroke();
  }

  endStroke(): Stroke | null {
    if (!this.currentStroke) return null;

    const completedStroke = {
      ...this.currentStroke,
      points: [...this.currentPoints],
    };

    this.currentStroke = null;
    this.currentPoints = [];

    if (completedStroke.points.length > 0) {
      this.historyManager.addStroke(completedStroke);
    }

    return completedStroke;
  }

  isDrawing(): boolean {
    return this.currentStroke !== null;
  }

  getCurrentStroke(): Stroke | null {
    return this.currentStroke;
  }

  clearCanvas(): void {
    const width = this.canvas.width / this.pixelRatio;
    const height = this.canvas.height / this.pixelRatio;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  redrawAll(): void {
    this.clearCanvas();
    const strokes = this.historyManager.getStrokes();

    for (const stroke of strokes) {
      this.renderSingleStroke(this.ctx, stroke);
    }

    // If currently drawing, render the in-progress stroke
    if (this.currentStroke && this.currentPoints.length > 0) {
      this.renderSingleStroke(this.ctx, {
        ...this.currentStroke,
        points: this.currentPoints,
      });
    }
  }

  private renderSingleStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    const points = stroke.points;
    if (points.length === 0) return;

    this.applyBrushStyle(ctx, stroke.tool, stroke.color, stroke.size, stroke.opacity);

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    // Connect last segment
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  private applyBrushStyle(
    ctx: CanvasRenderingContext2D,
    tool: ToolType,
    color: string,
    size: number,
    opacity: number
  ): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;

    if (tool === 'eraser') {
      // Destination-out cleanly erases pixels on the transparent drawing layer
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.hexToRgba(color, opacity);
      ctx.fillStyle = this.hexToRgba(color, opacity);
    } else {
      // Pen
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.hexToRgba(color, opacity);
      ctx.fillStyle = this.hexToRgba(color, opacity);
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
