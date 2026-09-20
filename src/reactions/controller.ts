import type { Point, ReactionEvent, ReactionGesture, Settings } from '../core/types';
import type { ReactionPose } from './pose';

export type ReactionState = 'IDLE' | 'CANDIDATE' | 'STABLE' | 'FIRED' | 'WAITING_FOR_RELEASE';

export class ReactionController {
  state: ReactionState = 'IDLE';
  gesture: ReactionGesture | 'neutral' = 'neutral';
  confidence = 0;
  private candidateAt = 0;
  private lastFiredAt = -Infinity;
  constructor(private readonly holdMs = 260, private readonly cooldownMs = 1200) {}

  update(pose: ReactionPose, position: Point, now: number, settings: Settings, wallNow = Date.now()): ReactionEvent | null {
    this.confidence = pose.confidence;
    if (this.state === 'STABLE') { this.state = 'FIRED'; return null; }
    if (this.state === 'FIRED') { this.state = 'WAITING_FOR_RELEASE'; return null; }
    if (this.state === 'WAITING_FOR_RELEASE') {
      if (pose.gesture === 'neutral' || pose.confidence < .55) { this.state = 'IDLE'; this.gesture = 'neutral'; }
      return null;
    }
    const gesture = pose.gesture;
    if (gesture === 'neutral') { this.state = 'IDLE'; this.gesture = 'neutral'; return null; }
    const slot = settings.reactionSlots.find(item => item.enabled && item.gesture === gesture);
    if (!settings.reactionsEnabled || !slot || pose.confidence < .62) { this.state = 'IDLE'; this.gesture = 'neutral'; return null; }
    if (now - this.lastFiredAt < this.cooldownMs) return null;
    if (this.state !== 'CANDIDATE' || this.gesture !== pose.gesture) {
      this.state = 'CANDIDATE'; this.gesture = gesture; this.candidateAt = now; return null;
    }
    if (now - this.candidateAt < this.holdMs) return null;
    this.state = 'STABLE'; this.lastFiredAt = now;
    return { id: crypto.randomUUID(), type: gesture, emoji: slot.emoji, position: { ...position }, createdAt: wallNow, duration: settings.reactionDurationMs, intensity: settings.reactionIntensity };
  }

  suppress(): void {
    if (this.state === 'STABLE' || this.state === 'FIRED' || this.state === 'WAITING_FOR_RELEASE') this.state = 'WAITING_FOR_RELEASE';
    else this.state = 'IDLE';
    this.gesture = 'neutral'; this.confidence = 0;
  }
  trackingLost(): void { this.reset(); }
  reset(): void { this.state = 'IDLE'; this.gesture = 'neutral'; this.confidence = 0; this.candidateAt = 0; }
}
