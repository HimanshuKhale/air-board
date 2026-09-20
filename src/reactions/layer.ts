import type { ReactionEvent } from '../core/types';
import { validReactionEvent } from './event';

export class ReactionLayer {
  private seen = new Map<string, number>();
  private timers = new Map<string, number>();
  constructor(private readonly root: HTMLElement, private readonly maximum = 12) {}
  show(event: ReactionEvent, now = Date.now()): boolean {
    this.cleanup(now);
    if (!validReactionEvent(event, now) || this.seen.has(event.id) || this.root.childElementCount >= this.maximum) return false;
    this.seen.set(event.id, event.createdAt + event.duration + 5000);
    const effect = document.createElement('div'); effect.className = `reaction-effect ${event.intensity} ${event.emoji === '❤️' ? 'heart-burst' : 'single-reaction'}`;
    effect.dataset.reactionId = event.id; effect.dataset.reactionType = event.type;
    effect.style.left = `${Math.max(.08, Math.min(.92, event.position.x)) * 100}%`;
    effect.style.top = `${Math.max(.18, Math.min(.74, event.position.y)) * 100}%`;
    effect.style.setProperty('--reaction-duration', `${event.duration}ms`);
    const count = event.emoji === '❤️' ? event.intensity === 'normal' ? 5 : 3 : 1;
    for (let index = 0; index < count; index++) {
      const item = document.createElement('span'); item.textContent = event.emoji; item.style.setProperty('--reaction-index', String(index)); effect.append(item);
    }
    this.root.append(effect);
    const remaining = Math.max(0, event.createdAt + event.duration - now);
    this.timers.set(event.id, window.setTimeout(() => { effect.remove(); this.timers.delete(event.id); }, remaining));
    return true;
  }
  cleanup(now = Date.now()): void { for (const [id, expiry] of this.seen) if (expiry <= now) this.seen.delete(id); }
  clear(): void { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); this.root.replaceChildren(); }
}
