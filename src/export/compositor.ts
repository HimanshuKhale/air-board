import { BOARD, type BackgroundSettings } from '../core/types';
import type { BackgroundRenderer } from '../background/renderer';
export function exportFilename(date = new Date(), transparent = false): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `saai-airboard-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${transparent ? '-drawing' : ''}.png`;
}
export function composite(background: BackgroundRenderer, settings: BackgroundSettings, drawing: HTMLCanvasElement, transparent: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BOARD.width; canvas.height = BOARD.height;
  const ctx = canvas.getContext('2d')!;
  if (!transparent) background.draw(ctx, settings);
  ctx.drawImage(drawing, 0, 0);
  return canvas;
}
export async function savePng(canvas: HTMLCanvasElement, transparent: boolean): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = exportFilename(new Date(), transparent); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
