import type { Point, Stroke } from '../core/types';
import type { InteractionVisuals } from '../interaction/controller';
import { bounds } from '../selection/geometry';

export function drawInteractionOverlay(ctx: CanvasRenderingContext2D, visuals: InteractionVisuals, strokes: Stroke[], selectedIds: string[]): void {
  ctx.save();
  if (visuals.lasso.length) {
    ctx.strokeStyle = '#3b6fe8'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); visuals.lasso.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
    if (visuals.lassoStart) { ctx.setLineDash([]); ctx.fillStyle = '#3b6fe8'; ctx.beginPath(); ctx.arc(visuals.lassoStart.x, visuals.lassoStart.y, 8, 0, Math.PI * 2); ctx.fill(); }
  }
  const selected = strokes.filter(stroke => selectedIds.includes(stroke.id));
  if (selected.length) {
    const all = selected.flatMap(stroke => stroke.points);
    const box = bounds(all); const padding = 12;
    ctx.strokeStyle = '#3b6fe8'; ctx.fillStyle = 'rgba(59,111,232,.06)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.fillRect(box.minX - padding, box.minY - padding, box.maxX - box.minX + padding * 2, box.maxY - box.minY + padding * 2);
    ctx.strokeRect(box.minX - padding, box.minY - padding, box.maxX - box.minX + padding * 2, box.maxY - box.minY + padding * 2);
  }
  if (visuals.planeTarget !== null) {
    const targets: Point[] = [{ x: 55, y: 55 }, { x: 1545, y: 55 }, { x: 1545, y: 845 }, { x: 55, y: 845 }];
    const labels = ['TOP LEFT', 'TOP RIGHT', 'BOTTOM RIGHT', 'BOTTOM LEFT'];
    const point = targets[visuals.planeTarget];
    ctx.setLineDash([]); ctx.fillStyle = 'rgba(34,92,74,.92)'; ctx.beginPath(); ctx.arc(point.x, point.y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(visuals.planeTarget + 1), point.x, point.y + 5);
    ctx.fillStyle = '#225c4a'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(`POINT TO ${labels[visuals.planeTarget]} AND PINCH`, 800, 48);
  }
  if (visuals.stylusTarget) {
    ctx.setLineDash([]); ctx.strokeStyle = '#225c4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(800, 450, 28, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(758, 450); ctx.lineTo(842, 450); ctx.moveTo(800, 408); ctx.lineTo(800, 492); ctx.stroke();
    ctx.fillStyle = '#225c4a'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ALIGN STYLUS TIP AND PINCH', 800, 390);
  }
  ctx.restore();
}
