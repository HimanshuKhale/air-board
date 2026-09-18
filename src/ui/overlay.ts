import { BOARD, type Point } from '../core/types';
import { cameraToCanvas } from '../core/coordinates';
import type { HandPointer } from '../input/gesture';
import type { Settings, Size } from '../core/types';
const edges = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
export function drawDebug(ctx: CanvasRenderingContext2D, pointer: HandPointer | null, camera: Size, settings: Settings, metrics: string): void {
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#18c8ed';
  const map = (p: Point) => cameraToCanvas(p, camera, BOARD, settings.background.mirror, settings.background.mode === 'camera' ? settings.background.fit : 'stretch');
  if (pointer) {
    for (const edge of edges) {
      ctx.beginPath();
      edge.forEach((index, i) => { const p = map(pointer.landmarks[index]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    }
    for (const [point, color] of [[pointer.raw, '#e45757'], [pointer.smooth, '#2fc980']] as const) {
      const p = map(point); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(12,25,20,.86)'; ctx.fillRect(16, 16, 700, 80);
  ctx.fillStyle = '#fff'; ctx.font = '18px monospace'; ctx.fillText(metrics, 30, 46);
  ctx.fillText(pointer ? `${pointer.phase} · tip/palm ${pointer.ratio.toFixed(2)} · thresholds ${settings.pinchClose}/${settings.pinchOpen}` : 'No hand · pointer up', 30, 76);
  ctx.restore();
}
