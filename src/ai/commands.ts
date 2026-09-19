import type { ShapeKind } from '../core/types';
import type { DiagramPlan } from './plan';

export type Intent =
  | { kind: 'diagram'; plan: DiagramPlan }
  | { kind: 'create'; type: ShapeKind; count: number }
  | { kind: 'label'; target: string; text: string }
  | { kind: 'connect'; from: string; to: string }
  | { kind: 'recolor'; target: string; color: string }
  | { kind: 'move'; target: string; direction: 'up' | 'down' | 'left' | 'right' }
  | { kind: 'resize'; target: string; factor: number }
  | { kind: 'select'; target: string }
  | { kind: 'add-below'; anchor: string; label: string }
  | { kind: 'undo' | 'redo' | 'delete' | 'clear' };
const colors: Record<string, string> = { red: '#da5650', लाल: '#da5650', blue: '#3b6fe8', नीला: '#3b6fe8', green: '#225c4a', हरा: '#225c4a', black: '#202a35', काला: '#202a35', yellow: '#e5ad38', पीला: '#e5ad38' };
const numbers: Record<string, number> = { one: 1, ek: 1, एक: 1, two: 2, do: 2, दो: 2, three: 3, teen: 3, तीन: 3, four: 4, chaar: 4, चार: 4 };
const types: Record<string, ShapeKind> = { box: 'rectangle', boxes: 'rectangle', rectangle: 'rectangle', rectangles: 'rectangle', आयत: 'rectangle', circle: 'ellipse', circles: 'ellipse', गोला: 'ellipse', ellipse: 'ellipse', triangle: 'triangle', त्रिकोण: 'triangle', arrow: 'arrow', तीर: 'arrow', line: 'line', रेखा: 'line' };
const clean = (s: string) => s.trim().replace(/[.!?।]+$/g, '').trim();
const slug = (s: string, i: number) => (s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 26) || 'node') + '_' + i;
/** Parse finalized text only. A wake word or explicit Command Mode is required. */
export function parseCommand(transcript: string, commandMode = false): Intent | null {
  const raw = clean(transcript);
  const woke = /^airs*board[,:\s]*/i.test(raw);
  if (!woke && !commandMode) return null;
  const text = clean(woke ? raw.replace(/^air\s*board[,:\s]*/i, '') : raw).toLowerCase();
  if (!text || text.length > 500 || /[<>]/.test(text)) return null;
  if (/^(undo|वापस|pichla|पिछला)/.test(text)) return { kind: 'undo' };
  if (/^(redo|फिर से)/.test(text)) return { kind: 'redo' };
  if (/^(delete|remove|हटाओ|mita do)/.test(text)) return { kind: 'delete' };
  if (/^(clear|saaf|साफ)/.test(text)) return { kind: 'clear' };
  const tree = text.match(/(?:tree|पेड़)\s+(?:with|of|for|mein|में)\s+(.+)/);
  if (tree && /(?:create|make|banao|बनाओ|draw)/.test(text)) {
    const labels = tree[1].split(/\s*,\s*|\s+(?:and|aur|और)\s+/).map(clean).filter(Boolean);
    if (labels.length >= 2 && labels.length <= 6 && labels.every(label => label.length <= 80)) {
      const nodes = labels.map((label, i) => ({ id: slug(label, i), type: 'rectangle' as const, label }));
      return { kind: 'diagram', plan: { version: 1, operation: 'create_diagram', layout: 'tree', nodes, edges: nodes.slice(1).map(node => ({ from: nodes[0].id, to: node.id })) } };
    }
  }
  const flow = text.match(/(?:flowchart|flow chart|process diagram|diagram|फ्लोचार्ट)\s+(?:with|of|for|mein|में)\s+(.+)/);
  if (flow && /(?:create|make|banao|बनाओ|draw|बनाइए)/.test(text)) {
    const labels = flow[1].split(/\s*,\s*|\s+(?:and|aur|और|then|to)\s+/).map(clean).filter(Boolean);
    if (labels.length >= 2 && labels.length <= 8 && labels.every(label => label.length <= 80)) {
      const nodes = labels.map((label, i) => ({ id: slug(label, i), type: 'rectangle' as const, label }));
      return { kind: 'diagram', plan: { version: 1, operation: 'create_diagram', layout: /vertical|neeche|नीचे/.test(text) ? 'vertical' : 'horizontal', nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })) } };
    }
  }
  if (/(?:client\s*server|client\/server|architecture)/.test(text) && /(?:create|make|banao|बनाओ)/.test(text)) {
    const labels = ['Client', 'API', 'Database'];
    return { kind: 'diagram', plan: { version: 1, operation: 'create_diagram', layout: 'architecture', nodes: labels.map((label, i) => ({ id: slug(label, i), type: 'rectangle', label })), edges: [{ from: 'client_0', to: 'api_1' }, { from: 'api_1', to: 'database_2' }] } };
  }
  if (/(?:input.process.output|ipo)/.test(text) && /(?:create|make|banao|बनाओ)/.test(text)) {
    return { kind: 'diagram', plan: { version: 1, operation: 'create_diagram', layout: 'ipo', nodes: ['Input', 'Process', 'Output'].map((label, i) => ({ id: slug(label, i), type: 'rectangle', label })), edges: [{ from: 'input_0', to: 'process_1' }, { from: 'process_1', to: 'output_2' }] } };
  }
  const below = text.match(/^(?:ab\s+)?(.+?)\s+(?:ke neeche|के नीचे|below)\s+(.+?)\s+(?:add karo|add|jodo|जोड़ो|डालो)$/);
  if (below) return { kind: 'add-below', anchor: clean(below[1]), label: clean(below[2]) };
  const connect = text.match(/^(?:connect|jodo|जोड़ो)\s+(.+?)\s+(?:to|se|से)\s+(.+?)(?:\s+को)?$/);
  if (connect) return { kind: 'connect', from: clean(connect[1]).replace(/^the\s+/, ''), to: clean(connect[2]).replace(/^the\s+/, '') };
  const label = text.match(/^(?:is|this|ye|यह)\s+(box|rectangle|circle|shape|selected|object)?\s*(?:ko|को)?\s+(.+?)\s+(?:naam do|name do|label karo|नाम दो|label)$/);
  if (label) return { kind: 'label', target: label[1] || 'selected', text: clean(label[2]) };
  const recolor = text.match(/^(?:ye|this|selected|is|यह)?\s*(arrow|box|rectangle|shape|object)?\s*(?:ko|को)?\s+(red|blue|green|black|yellow|लाल|नीला|हरा|काला|पीला)\s+(?:kar do|karo|make|कर दो)$/);
  if (recolor) return { kind: 'recolor', target: recolor[1] || 'selected', color: colors[recolor[2]] };
  const move = text.match(/^(?:move|shift|hatao|हटाओ)\s+(.+?)\s+(up|down|left|right|upar|neeche|ऊपर|नीचे)$/);
  if (move) return { kind: 'move', target: clean(move[1]), direction: ({ upar: 'up', neeche: 'down', ऊपर: 'up', नीचे: 'down' } as Record<string, 'up' | 'down'>)[move[2]] || move[2] as 'up' | 'down' | 'left' | 'right' };
  const resize = text.match(/^(?:resize|make|bada|chhota)\s+(.+?)\s+(bigger|smaller|large|small|बड़ा|छोटा)$/);
  if (resize) return { kind: 'resize', target: clean(resize[1]), factor: /bigger|large|बड़ा/.test(resize[2]) ? 1.2 : 0.8 };
  const select = text.match(/^(?:select|choose|chuno|चुनो)\s+(.+)$/);
  if (select) return { kind: 'select', target: clean(select[1]) };
  const create = text.match(/^(?:create|make|draw|banao|बनाओ)?\s*(one|two|three|four|ek|do|teen|chaar|एक|दो|तीन|चार|[1-4])?\s*(box|boxes|rectangle|rectangles|circle|circles|ellipse|triangle|arrow|line|आयत|गोला|त्रिकोण|तीर|रेखा)\s*(?:banao|बनाओ|draw|please)?$/);
  if (create) return { kind: 'create', type: types[create[2]], count: numbers[create[1]] || Number(create[1]) || 1 };
  return null;
}
