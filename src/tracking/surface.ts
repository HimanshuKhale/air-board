import { captureDimensions, pixelSummary, type PixelSummary } from './protocol';
/** Separate 2D input canvas; never use the MediaPipe-owned WebGL canvas as a 2D surface. */
export class InferenceSurface {
  readonly canvas = new OffscreenCanvas(1, 1);
  private context = this.canvas.getContext('2d', { willReadFrequently: true })!;
  private thumbnail = new OffscreenCanvas(1, 1);
  prepare(bitmap: ImageBitmap): OffscreenCanvas {
    if (!bitmap || bitmap.width <= 0 || bitmap.height <= 0) throw new Error('Received bitmap is closed or has zero dimensions');
    if (bitmap.width > 8192 || bitmap.height > 8192) throw new Error('Received bitmap dimensions exceed the input safety limit');
    if (this.canvas.width !== bitmap.width || this.canvas.height !== bitmap.height) {
      this.canvas.width = bitmap.width; this.canvas.height = bitmap.height;
    }
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.globalCompositeOperation = 'copy';
    this.context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    this.context.globalCompositeOperation = 'source-over';
    return this.canvas;
  }
  snapshot(): { bitmap: ImageBitmap; pixels: PixelSummary } {
    const scaled = captureDimensions(this.canvas.width, this.canvas.height);
    const ratio = Math.min(1, 240 / Math.max(scaled.width, scaled.height));
    this.thumbnail.width = Math.max(1, Math.round(scaled.width * ratio));
    this.thumbnail.height = Math.max(1, Math.round(scaled.height * ratio));
    const ctx = this.thumbnail.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(this.canvas, 0, 0, this.thumbnail.width, this.thumbnail.height);
    const pixels = pixelSummary(ctx.getImageData(0, 0, this.thumbnail.width, this.thumbnail.height).data);
    // Transfer ONLY the thumbnail. transferToImageBitmap on the inference canvas would clear it.
    return { bitmap: this.thumbnail.transferToImageBitmap(), pixels };
  }
}
