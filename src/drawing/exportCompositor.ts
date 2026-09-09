/**
 * SAAI AirBoard - Export Compositor
 *
 * Composites the active background and clean drawing canvas into a high-res PNG.
 * Never includes toolbars, cursors, debug indicators, or overlays.
 */

import { BackgroundManager } from './backgroundManager';
import { DrawingEngine } from './drawingEngine';

export interface ExportOptions {
  includeBackground: boolean; // true = composite with bg, false = transparent drawing only
  fileName?: string;
}

export function formatExportTimestamp(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `saai-airboard-${y}-${m}-${d}-${h}${min}${s}.png`;
}

export class ExportCompositor {
  private drawingEngine: DrawingEngine;
  private backgroundManager: BackgroundManager;

  constructor(drawingEngine: DrawingEngine, backgroundManager: BackgroundManager) {
    this.drawingEngine = drawingEngine;
    this.backgroundManager = backgroundManager;
  }

  /**
   * Generates a composite canvas at natural display resolution.
   */
  async createCompositeCanvas(
    options: ExportOptions,
    videoElement?: HTMLVideoElement | null
  ): Promise<HTMLCanvasElement> {
    const sourceCanvas = this.drawingEngine.getCanvas();
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create export canvas context');

    // Step 1: Render Background Layer (if requested)
    if (options.includeBackground) {
      this.backgroundManager.renderToCanvas(ctx, width, height, videoElement);
    } else {
      // Transparent background
      ctx.clearRect(0, 0, width, height);
    }

    // Step 2: Composite the clean drawing layer (source-over)
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.restore();

    return exportCanvas;
  }

  /**
   * Downloads the exported PNG directly in the presenter's browser.
   */
  async exportImage(
    options: ExportOptions,
    videoElement?: HTMLVideoElement | null
  ): Promise<string> {
    const canvas = await this.createCompositeCanvas(options, videoElement);
    const dataUrl = canvas.toDataURL('image/png');
    const filename = options.fileName || formatExportTimestamp();

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return dataUrl;
  }
}
