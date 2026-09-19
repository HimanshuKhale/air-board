import type { BoardObject, Point, Stroke } from '../core/types';
import { bounds, pathLength } from '../selection/geometry';

export interface DigitRecognition { digit: string; confidence: number; error: number; margin: number; object: BoardObject }
type Template = { digit: string; strokes: Point[][] };
const lerpPath = (vertices: Point[], steps = 8): Point[] => vertices.slice(0, -1).flatMap((a, i) => Array.from({ length: steps }, (_, j) => ({ x: a.x + (vertices[i + 1].x - a.x) * j / steps, y: a.y + (vertices[i + 1].y - a.y) * j / steps }))).concat(vertices.at(-1)!);
const oval = (cx: number, cy: number, rx: number, ry: number, start = -Math.PI / 2): Point[] => Array.from({ length: 49 }, (_, i) => ({ x: cx + rx * Math.cos(start + i * Math.PI * 2 / 48), y: cy + ry * Math.sin(start + i * Math.PI * 2 / 48) }));
const templates: Template[] = [
  { digit: '0', strokes: [oval(.5, .5, .34, .47)] },
  { digit: '0', strokes: [oval(.5, .5, .4, .46, Math.PI)] },
  { digit: '1', strokes: [lerpPath([{ x: .35, y: .18 }, { x: .52, y: .04 }, { x: .52, y: .96 }])] },
  { digit: '1', strokes: [lerpPath([{ x: .5, y: .04 }, { x: .5, y: .96 }])] },
  { digit: '2', strokes: [lerpPath([{ x: .18, y: .2 }, { x: .35, y: .04 }, { x: .72, y: .08 }, { x: .82, y: .28 }, { x: .66, y: .48 }, { x: .16, y: .92 }, { x: .86, y: .92 }])] },
  { digit: '3', strokes: [lerpPath([{ x: .2, y: .12 }, { x: .48, y: .02 }, { x: .78, y: .13 }, { x: .56, y: .48 }, { x: .8, y: .62 }, { x: .7, y: .9 }, { x: .34, y: .98 }, { x: .14, y: .86 }])] },
  { digit: '4', strokes: [lerpPath([{ x: .72, y: .98 }, { x: .72, y: .04 }, { x: .12, y: .66 }, { x: .9, y: .66 }])] },
  { digit: '4', strokes: [lerpPath([{ x: .68, y: .04 }, { x: .12, y: .65 }, { x: .9, y: .65 }]), lerpPath([{ x: .68, y: .04 }, { x: .68, y: .98 }])] },
  { digit: '5', strokes: [lerpPath([{ x: .82, y: .06 }, { x: .22, y: .06 }, { x: .18, y: .48 }, { x: .58, y: .46 }, { x: .82, y: .6 }, { x: .76, y: .88 }, { x: .42, y: .98 }, { x: .14, y: .86 }])] },
  { digit: '5', strokes: [lerpPath([{ x: .82, y: .06 }, { x: .22, y: .06 }, { x: .18, y: .5 }]), lerpPath([{ x: .18, y: .5 }, { x: .6, y: .46 }, { x: .82, y: .66 }, { x: .68, y: .94 }, { x: .28, y: .94 }])] },
  { digit: '6', strokes: [lerpPath([{ x: .76, y: .08 }, { x: .42, y: .03 }, { x: .18, y: .34 }, { x: .16, y: .72 }, { x: .34, y: .96 }, { x: .7, y: .9 }, { x: .82, y: .65 }, { x: .66, y: .48 }, { x: .28, y: .52 }, { x: .17, y: .72 }])] },
  { digit: '7', strokes: [lerpPath([{ x: .14, y: .08 }, { x: .88, y: .08 }, { x: .42, y: .98 }])] },
  { digit: '8', strokes: [Array.from({ length: 65 }, (_, i) => { const t = i * Math.PI * 2 / 64; return { x: .5 + .3 * Math.sin(2 * t), y: .5 - .46 * Math.cos(t) }; })] },
  { digit: '9', strokes: [lerpPath([...oval(.48, .3, .3, .27).slice(0, -1), { x: .77, y: .3 }, { x: .72, y: .72 }, { x: .48, y: .98 }])] },
];

function resample(points: Point[], count = 32): Point[] {
  const length = pathLength(points); if (!length || points.length < 2) return Array.from({ length: count }, () => ({ ...points[0] }));
  const result: Point[] = []; let index = 1, travelled = 0;
  for (let i = 0; i < count; i++) {
    const target = length * i / (count - 1);
    while (index < points.length - 1) { const segment = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y); if (travelled + segment >= target) break; travelled += segment; index++; }
    const a = points[index - 1], b = points[index], segment = Math.hypot(b.x - a.x, b.y - a.y), t = segment ? (target - travelled) / segment : 0;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}
function normalize(strokes: Point[][]): Point[][] {
  const all = strokes.flat(), b = bounds(all), width = b.maxX - b.minX, height = b.maxY - b.minY, scale = Math.max(width, height, 1);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  return strokes.map(stroke => resample(stroke).map(point => ({ x: (point.x - cx) / scale + .5, y: (point.y - cy) / scale + .5 })));
}
const strokeError = (a: Point[], b: Point[]) => a.reduce((sum, point, i) => sum + Math.hypot(point.x - b[i].x, point.y - b[i].y), 0) / a.length;
function templateError(input: Point[][], template: Point[][]): number {
  if (input.length !== template.length) return Infinity;
  const score = (ordered: Point[][]) => ordered.reduce((sum, stroke, i) => sum + Math.min(strokeError(stroke, template[i]), strokeError([...stroke].reverse(), template[i])), 0) / ordered.length;
  if (input.length === 2) return Math.min(score(input), score([input[1], input[0]]));
  return score(input);
}

/** Small deterministic local template recognizer. It processes only completed ink geometry. */
export function recognizeDigit(strokes: Stroke[]): DigitRecognition | null {
  if (!strokes.length || strokes.length > 2 || strokes.some(stroke => stroke.brush.tool !== 'pen' || stroke.points.length < 2)) return null;
  const points = strokes.flatMap(stroke => stroke.points), b = bounds(points), width = b.maxX - b.minX, height = b.maxY - b.minY;
  if (Math.hypot(width, height) < 55 || height < 35 || pathLength(points) < 60) return null;
  const normalized = normalize(strokes.map(stroke => stroke.points));
  const scores = templates.filter(template => template.strokes.length === strokes.length).map(template => ({ digit: template.digit, error: templateError(normalized, normalize(template.strokes)) })).sort((a, b) => a.error - b.error);
  const best = scores[0]; if (!best || best.error > .2) return null;
  const alternative = scores.find(score => score.digit !== best.digit), margin = (alternative?.error ?? .4) - best.error;
  const confidence = Math.max(0, Math.min(.99, 1 - best.error / .27)) * Math.max(.55, Math.min(1, margin / .08));
  const objectWidth = Math.max(36, width), objectHeight = Math.max(56, height);
  const x = Math.max(0, Math.min(1600 - objectWidth, b.minX - (objectWidth - width) / 2));
  const y = Math.max(0, Math.min(900 - objectHeight, b.minY - (objectHeight - height) / 2));
  return { digit: best.digit, confidence, error: best.error, margin, object: { id: crypto.randomUUID(), type: 'text', x, y, width: objectWidth, height: objectHeight, color: strokes[0].brush.color, strokeWidth: strokes[0].brush.size, text: best.digit } };
}
