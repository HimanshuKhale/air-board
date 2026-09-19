import type { ConfirmationPose } from './pose';

export const SHAPE_CONFIRMATION_MS = 8000;
export type ConfirmationDecision = 'yes' | 'no' | 'timeout';
export interface ConfirmationRequest { id: string; label: string; startedAt: number; expiresAt: number }
export interface ConfirmationProgress { pose: ConfirmationPose; confidence: number; heldMs: number }

/** Monotonic, request-bound single-settlement state machine with release-to-rearm. */
export class ConfirmationMachine {
  request: ConfirmationRequest | null = null;
  progress: ConfirmationProgress = { pose: 'neutral', confidence: 0, heldMs: 0 };
  private candidate: ConfirmationPose = 'neutral';
  private candidateAt = 0;
  private released = true;
  private settled = new Set<string>();
  constructor(private holdMs = 400, private readonly durationMs = SHAPE_CONFIRMATION_MS) {}
  setHoldMs(value: number): void { this.holdMs = Math.max(300, Math.min(500, value)); }
  begin(id: string, label: string, now: number): ConfirmationRequest {
    if (!id || this.settled.has(id)) throw new Error('Confirmation request ID must be new');
    this.request = { id, label, startedAt: now, expiresAt: now + this.durationMs };
    this.candidate = 'neutral'; this.candidateAt = now; this.progress = { pose: 'neutral', confidence: 0, heldMs: 0 };
    return this.request;
  }
  remaining(now: number): number { return this.request ? Math.max(0, this.request.expiresAt - now) : 0; }
  observe(pose: ConfirmationPose, confidence: number, now: number): { id: string; decision: ConfirmationDecision } | null {
    const timeout = this.tick(now); if (timeout) return timeout;
    if (pose === 'neutral') { this.released = true; this.candidate = 'neutral'; this.candidateAt = now; this.progress = { pose, confidence, heldMs: 0 }; return null; }
    if (!this.request || !this.released || confidence < .55) { this.progress = { pose, confidence, heldMs: 0 }; return null; }
    if (pose !== this.candidate) { this.candidate = pose; this.candidateAt = now; }
    const heldMs = Math.max(0, now - this.candidateAt); this.progress = { pose, confidence, heldMs };
    if (heldMs < this.holdMs) return null;
    return this.settle(this.request.id, pose === 'CONFIRM_YES' ? 'yes' : 'no');
  }
  tick(now: number): { id: string; decision: ConfirmationDecision } | null {
    if (!this.request || now < this.request.expiresAt) return null;
    return this.settle(this.request.id, 'timeout');
  }
  settle(id: string, decision: ConfirmationDecision): { id: string; decision: ConfirmationDecision } | null {
    if (!this.request || this.request.id !== id || this.settled.has(id)) return null;
    this.settled.add(id); this.request = null; this.candidate = 'neutral'; this.progress = { pose: 'neutral', confidence: 0, heldMs: 0 };
    this.released = false;
    if (this.settled.size > 256) this.settled.delete(this.settled.values().next().value!);
    return { id, decision };
  }
  interrupt(): void { this.candidate = 'neutral'; this.candidateAt = 0; this.progress = { pose: 'neutral', confidence: 0, heldMs: 0 }; this.released = false; }
  cancel(): void { if (this.request) this.settled.add(this.request.id); this.request = null; this.candidate = 'neutral'; this.progress = { pose: 'neutral', confidence: 0, heldMs: 0 }; this.released = false; }
}
