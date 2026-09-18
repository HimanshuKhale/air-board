import { BOARD, type HistoryState, type Stroke } from '../core/types';
import { currentStrokes, type MovePreview } from './history';
export function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (!stroke.points.length) return;
  const { points, brush } = stroke;
  ctx.save();
  ctx.globalCompositeOperation = brush.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = brush.tool === 'eraser' ? 1 : brush.opacity * (brush.tool === 'highlighter' ? 0.28 : 1);
  ctx.strokeStyle = brush.color; ctx.fillStyle = brush.color;
  ctx.lineWidth = brush.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, brush.size / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const next = points[i + 1];
      ctx.quadraticCurveTo(points[i].x, points[i].y, (points[i].x + next.x) / 2, (points[i].y + next.y) / 2);
    }
    const last = points.at(-1)!;
    ctx.lineTo(last.x, last.y); ctx.stroke();
  }
  ctx.restore();
}
export class DrawingEngine {
  private readonly committed = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly cache: CanvasRenderingContext2D;
  private dirty = true;
  private historyDirty = true;
  private movePreview: MovePreview | null = null;
  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = this.committed.width = BOARD.width;
    canvas.height = this.committed.height = BOARD.height;
    this.context = canvas.getContext('2d')!;
    this.cache = this.committed.getContext('2d')!;
  }
  invalidate(committed = true): void { this.dirty = true; this.historyDirty ||= committed; }
  setMovePreview(preview: MovePreview | null): void { this.movePreview = preview; this.dirty = true; }
  render(history: HistoryState): void {
    if (!this.dirty) return;
    if (this.movePreview) {
      this.context.clearRect(0, 0, BOARD.width, BOARD.height);
      for (const stroke of currentStrokes(history, this.movePreview)) paintStroke(this.context, stroke);
      this.dirty = false; return;
    }
    if (this.historyDirty) {
      this.cache.clearRect(0, 0, BOARD.width, BOARD.height);
      const committed = { ...history, active: null };
      for (const stroke of currentStrokes(committed)) paintStroke(this.cache, stroke);
    }
    // One transparent scratch composition per frame prevents highlighter opacity buildup.
    this.context.clearRect(0, 0, BOARD.width, BOARD.height);
    this.context.drawImage(this.committed, 0, 0);
    if (history.active) paintStroke(this.context, history.active);
    this.dirty = false; this.historyDirty = false;
  }
}
