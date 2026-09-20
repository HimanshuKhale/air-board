import { BOARD, type BoardObject, type HistoryState, type Stroke } from '../core/types';
import { currentScene, type MovePreview } from './history';
import { paintObject } from './objects';
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
  private objectPreviews: BoardObject[] = [];
  private hiddenPreviewIds = new Set<string>();
  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = this.committed.width = BOARD.width;
    canvas.height = this.committed.height = BOARD.height;
    this.context = canvas.getContext('2d')!;
    this.cache = this.committed.getContext('2d')!;
  }
  invalidate(committed = true): void { this.dirty = true; this.historyDirty ||= committed; }
  setMovePreview(preview: MovePreview | null): void { this.movePreview = preview; this.dirty = true; }
  setObjectPreview(preview: BoardObject | null): void { this.setObjectPreviews(preview ? [preview] : []); }
  setObjectPreviews(previews: BoardObject[] | null, hiddenIds: string[] = []): void { this.objectPreviews = previews?.map(object => ({ ...object, vertices: object.vertices?.map(point => ({ ...point })) })) ?? []; this.hiddenPreviewIds = new Set(hiddenIds); this.dirty = true; }
  render(history: HistoryState): void {
    if (!this.dirty) return;
    if (this.movePreview || this.objectPreviews.length) {
      this.context.clearRect(0, 0, BOARD.width, BOARD.height);
      const scene = currentScene(history, this.movePreview);
      for (const stroke of scene.strokes) paintStroke(this.context, stroke);
      const previews = new Map(this.objectPreviews.map(object => [object.id, object]));
      for (const object of scene.objects) if (!this.hiddenPreviewIds.has(object.id)) paintObject(this.context, previews.get(object.id) ?? object);
      for (const object of this.objectPreviews) if (!scene.objects.some(item => item.id === object.id)) paintObject(this.context, object);
      this.dirty = false; return;
    }
    if (this.historyDirty) {
      this.cache.clearRect(0, 0, BOARD.width, BOARD.height);
      const committed = { ...history, active: null };
      const scene = currentScene(committed);
      for (const stroke of scene.strokes) paintStroke(this.cache, stroke);
      for (const object of scene.objects) paintObject(this.cache, object);
    }
    // One transparent scratch composition per frame prevents highlighter opacity buildup.
    this.context.clearRect(0, 0, BOARD.width, BOARD.height);
    this.context.drawImage(this.committed, 0, 0);
    if (history.active) paintStroke(this.context, history.active);
    this.dirty = false; this.historyDirty = false;
  }
}
