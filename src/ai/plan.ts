import type { BoardObject } from '../core/types';
import { BOARD } from '../core/types';
import { currentObjects, currentStrokes } from '../drawing/history';
import { bounds } from '../selection/geometry';
import type { HistoryState } from '../core/types';

/** Strict, versioned intermediate plan. Model output, if later enabled, must pass this validator. */
export interface DiagramPlan {
  version: 1; operation: 'create_diagram'; layout: 'horizontal' | 'vertical' | 'tree' | 'architecture' | 'ipo';
  nodes: { id: string; type: 'rectangle' | 'ellipse' | 'triangle'; label: string }[];
  edges: { from: string; to: string }[];
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export function validDiagramPlan(value: unknown): value is DiagramPlan {
  if (!record(value) || value.version !== 1 || value.operation !== 'create_diagram' || !['horizontal', 'vertical', 'tree', 'architecture', 'ipo'].includes(String(value.layout)) || !keys(value, ['version', 'operation', 'layout', 'nodes', 'edges'])) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length < 1 || value.nodes.length > 12 || value.edges.length > 20) return false;
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (!record(node) || !keys(node, ['id', 'type', 'label']) || typeof node.id !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(node.id) || ids.has(node.id) || !['rectangle', 'ellipse', 'triangle'].includes(String(node.type)) || typeof node.label !== 'string' || !node.label.trim() || node.label.length > 80 || /[<>]/.test(node.label)) return false;
    ids.add(node.id);
  }
  if (!value.edges.every(edge => record(edge) && keys(edge, ['from', 'to']) && typeof edge.from === 'string' && typeof edge.to === 'string' && edge.from !== edge.to && ids.has(edge.from) && ids.has(edge.to))) return false;
  if (value.layout === 'tree') {
    if (value.edges.length !== value.nodes.length - 1) return false;
    const parents = new Map<string, string>();
    for (const edge of value.edges) { if (parents.has(edge.to)) return false; parents.set(edge.to, edge.from); }
    const roots = value.nodes.filter(node => !parents.has(node.id));
    if (roots.length !== 1) return false;
    for (const node of value.nodes) { const seen = new Set<string>(); let current = node.id; while (parents.has(current)) { if (seen.has(current)) return false; seen.add(current); current = parents.get(current)!; } if (current !== roots[0].id) return false; }
  }
  return true;
}
const intersects = (a: BoardObject, b: BoardObject) => a.x < b.x + b.width + 20 && a.x + a.width + 20 > b.x && a.y < b.y + b.height + 20 && a.y + a.height + 20 > b.y;
/** Places a complete plan without moving existing objects. Throws if the board is too full. */
export function composeDiagram(plan: DiagramPlan, history: HistoryState, color = '#225c4a'): BoardObject[] {
  if (!validDiagramPlan(plan)) throw new Error('Invalid diagram plan');
  const tree = plan.layout === 'tree', vertical = plan.layout === 'vertical' || tree;
  const n = plan.nodes.length, gap = vertical ? 48 : 64, height = 92;
  const widths = plan.nodes.map(node => Math.min(250, Math.max(155, node.label.length * 12 + 36)));
  const depths = new Map(plan.nodes.map(node => [node.id, 0]));
  if (tree) for (let pass = 0; pass < n; pass++) for (const edge of plan.edges) depths.set(edge.to, Math.max(depths.get(edge.to)!, depths.get(edge.from)! + 1));
  const rows = new Map<number, number[]>();
  if (tree) plan.nodes.forEach((node, i) => { const depth = Math.min(n - 1, depths.get(node.id)!); rows.set(depth, [...(rows.get(depth) || []), i]); });
  const rowWidth = (indices: number[]) => indices.reduce((sum, i) => sum + widths[i], 0) + gap * (indices.length - 1);
  const width = tree ? Math.max(...[...rows.values()].map(rowWidth)) : vertical ? Math.max(...widths) : widths.reduce((a, b) => a + b, 0) + gap * (n - 1);
  const totalHeight = tree ? rows.size * height + gap * (rows.size - 1) : vertical ? n * height + gap * (n - 1) : height;
  if (width > BOARD.width - 80 || totalHeight > BOARD.height - 80) throw new Error('Diagram is too large for the board');
  const occupied = [...currentObjects(history), ...currentStrokes(history).filter(stroke => stroke.brush.tool !== 'eraser').map(stroke => {
    const b = bounds(stroke.points);
    return { id: stroke.id, type: 'rectangle' as const, x: b.minX, y: b.minY, width: Math.max(1, b.maxX - b.minX), height: Math.max(1, b.maxY - b.minY), color, strokeWidth: 1, text: '' };
  })];
  let origin: { x: number; y: number } | null = null;
  for (let y = 60; y + totalHeight <= BOARD.height - 30 && !origin; y += 40)
    for (let x = 60; x + width <= BOARD.width - 30 && !origin; x += 40) {
      const candidate: BoardObject = { id: 'candidate', type: 'rectangle', x, y, width, height: totalHeight, color, strokeWidth: 2, text: '' };
      if (!occupied.some(object => intersects(candidate, object))) origin = { x, y };
    }
  if (!origin) throw new Error('No free space for the diagram');
  let cursor = 0;
  const rowCursor = new Map<number, number>();
  const byId = new Map<string, BoardObject>();
  const nodes = plan.nodes.map((node, i): BoardObject => {
    const depth = tree ? Math.min(n - 1, depths.get(node.id)!) : i;
    const treeX = (width - rowWidth(rows.get(depth) || [i])) / 2 + (rowCursor.get(depth) || 0);
    const object: BoardObject = { id: crypto.randomUUID(), type: node.type, x: origin!.x + (tree ? treeX : vertical ? (width - widths[i]) / 2 : cursor), y: origin!.y + (tree ? depth * (height + gap) : vertical ? i * (height + gap) : 0), width: widths[i], height, color, strokeWidth: 5, text: node.label };
    rowCursor.set(depth, (rowCursor.get(depth) || 0) + widths[i] + gap);
    cursor += widths[i] + gap; byId.set(node.id, object); return object;
  });
  const edges = plan.edges.map((edge): BoardObject => {
    const from = byId.get(edge.from)!, to = byId.get(edge.to)!;
    const a = vertical ? { x: from.x + from.width / 2, y: from.y + from.height } : { x: from.x + from.width, y: from.y + from.height / 2 };
    const b = vertical ? { x: to.x + to.width / 2, y: to.y } : { x: to.x, y: to.y + to.height / 2 };
    return { id: crypto.randomUUID(), type: 'connector', fromId: from.id, toId: to.id, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)), flipY: (b.x - a.x) * (b.y - a.y) < 0, color, strokeWidth: 4, text: '' };
  });
  return [...edges, ...nodes];
}
