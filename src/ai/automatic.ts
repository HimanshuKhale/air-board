import type { HistoryState } from '../core/types';
import { currentObjects } from '../drawing/history';
import type { DiagramPlan } from './plan';

export type AiMode = 'off' | 'commands' | 'automatic';
export interface AutomaticContext { revision: number; history: HistoryState; selectedIds: string[]; manipulating: boolean; now: number }
export interface DiagramSuggestion { revision: number; topic: string; summary: string; plan: DiagramPlan | null }
/** Planning boundary only. The UI deliberately disables Automatic mode until real speech tests pass. */
export class AutomaticPlanner {
  private topic = '';
  private segments: string[] = [];
  private seen = new Set<string>();
  private lastAt = 0;
  reset(): void { this.topic = ''; this.segments = []; this.seen.clear(); this.lastAt = 0; }
  ingest(finalized: string, context: AutomaticContext): DiagramSuggestion | null {
    const text = finalized.trim().toLowerCase();
    if (!text || text.length > 500 || context.manipulating || context.history.active) return null;
    const key = `${context.revision}:${text}`;
    if (this.seen.has(key)) return null;
    this.seen.add(key); if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value!);
    if (context.now - this.lastAt > 30_000) { this.topic = ''; this.segments = []; }
    this.lastAt = context.now;
    this.segments.push(text); if (this.segments.length > 6) this.segments.shift();
    const topic = text.match(/(?:about|on|regarding|बारे में)\s+([\w\s]{3,60})/)?.[1]?.trim() || this.topic || 'current explanation';
    this.topic = topic;
    // Existing content and revisions are inspected before suggestion. No board mutation occurs here.
    const existing = currentObjects(context.history).filter(object => object.text);
    if (context.now < 1500 || this.segments.length < 2 || existing.some(object => text.includes(object.text.toLowerCase()))) return null;
    const relationship = this.segments.join(' ').match(/([a-z][a-z\s]{2,30})\s+(?:leads to|connects to|goes to)\s+([a-z][a-z\s]{2,30})/);
    if (!relationship) return { revision: context.revision, topic, summary: 'Possible new diagram; review before adding.', plan: null };
    const labels = [relationship[1].trim(), relationship[2].trim()];
    const plan: DiagramPlan = { version: 1, operation: 'create_diagram', layout: 'horizontal', nodes: labels.map((label, i) => ({ id: `node_${i}`, type: 'rectangle', label })), edges: [{ from: 'node_0', to: 'node_1' }] };
    return { revision: context.revision, topic, summary: `Connect ${labels[0]} to ${labels[1]}?`, plan };
  }
}
