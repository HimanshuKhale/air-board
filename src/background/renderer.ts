import { BOARD, type BackgroundSettings, type Size } from '../core/types';
import { fitRect } from '../core/coordinates';
export function drawFitted(ctx: CanvasRenderingContext2D, source: CanvasImageSource, size: Size, target: Size, fit: BackgroundSettings['fit'], mirror = false, positionX = 0.5, positionY = 0.5): void {
  const rect = fitRect(size, target, fit);
  ctx.save();
  if (mirror) { ctx.translate(target.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (target.width - rect.width) * positionX, (target.height - rect.height) * positionY, rect.width, rect.height);
  ctx.restore();
}
export class BackgroundRenderer {
  private image: HTMLImageElement | null = null;
  private imageSource: string | null = null;
  private loaded = false;
  constructor(readonly video: HTMLVideoElement) {}
  async setImage(source: string | null): Promise<void> {
    if (source === this.imageSource) return;
    this.imageSource = source; this.loaded = false;
    if (!source) { this.image = null; return; }
    const image = new Image();
    image.src = source;
    await image.decode();
    if (this.imageSource === source) { this.image = image; this.loaded = true; }
  }
  draw(ctx: CanvasRenderingContext2D, settings: BackgroundSettings): void {
    ctx.save();
    ctx.clearRect(0, 0, BOARD.width, BOARD.height);
    ctx.fillStyle = settings.mode === 'blank' ? settings.color : '#18231f';
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    if (settings.mode === 'image' && this.image && this.loaded) drawFitted(ctx, this.image, { width: this.image.naturalWidth, height: this.image.naturalHeight }, BOARD, settings.fit, false, settings.positionX, settings.positionY);
    if (settings.mode === 'camera' && this.video.readyState >= 2 && this.video.srcObject) {
      drawFitted(ctx, this.video, { width: this.video.videoWidth, height: this.video.videoHeight }, BOARD, settings.fit, settings.mirror);
      ctx.fillStyle = `rgba(0,0,0,${settings.dim})`; ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    }
    ctx.restore();
  }
  get imageReady(): boolean { return this.loaded; }
}
export async function readLocalImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); throw new Error('Choose an image smaller than 40 megapixels.'); }
  bitmap.close();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
}
