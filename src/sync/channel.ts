import { initialState } from '../core/settings';
import { finishStroke } from '../drawing/history';
import { reduce, validCommand, validState, type Command } from './protocol';
import type { BoardState } from '../core/types';
import type { ReactionEvent } from '../core/types';
import { defaults } from '../core/settings';
import { validReactionEvent } from '../reactions/event';
export type Signal = { kind: 'camera-request' | 'camera-status' | 'export-request' | 'reaction'; sender: string; event?: ReactionEvent; [key: string]: unknown };
/** A Web Lock elects one command sequencer. Followers keep a full replica for failover. */
export class BoardChannel {
  readonly id = crypto.randomUUID();
  readonly channel = new BroadcastChannel('saai-airboard-v1');
  state: BoardState;
  ready = false;
  leader = false;
  private revision = 0;
  private epoch = '';
  private release?: () => void;
  private abort = new AbortController();
  private pending: { command: Command; requestId?: string }[] = [];
  private unacknowledged = new Map<string, Command>();
  private applied = new Set<string>();
  private retry: ReturnType<typeof setInterval>;
  private activeAt = 0;
  get currentRevision(): number { return this.revision; }
  onChange: (command?: Command, requestId?: string) => void = () => {};
  onRejected: (requestId: string, reason: string) => void = () => {};
  onSignal: (signal: Signal) => void = () => {};
  constructor(state: BoardState = initialState()) {
    this.state = state;
    this.channel.onmessage = event => this.receive(event.data);
    this.channel.postMessage({ v: 1, kind: 'hello', sender: this.id });
    this.retry = setInterval(() => {
      if (!this.ready) this.channel.postMessage({ v: 1, kind: 'hello', sender: this.id });
      if (this.leader && this.state.history.active && Date.now() - this.activeAt > 1500) this.send({ type: 'end', id: this.state.history.active.id });
      if (this.ready) for (const [requestId, command] of this.unacknowledged) this.deliver(requestId, command);
    }, 500);
    void navigator.locks.request('saai-airboard-board', { signal: this.abort.signal }, async () => {
      this.leader = true; this.ready = true; this.epoch = this.id;
      finishStroke(this.state.history);
      this.revision = 0;
      this.broadcastSnapshot(); this.onChange();
      this.flush();
      for (const [requestId, command] of this.unacknowledged) this.deliver(requestId, command);
      await new Promise<void>(resolve => { this.release = resolve; });
      this.leader = false;
    }).catch(error => { if (error.name !== 'AbortError') console.error(error); });
  }
  send(command: Command, suppliedRequestId?: string): void {
    if (!validCommand(command)) throw new Error('Invalid board command');
    if (!this.ready) { this.pending.push({ command, requestId: suppliedRequestId }); return; }
    const requestId = suppliedRequestId ?? (command.type === 'create-diagram' ? command.requestId : crypto.randomUUID());
    this.unacknowledged.set(requestId, command);
    this.deliver(requestId, command);
  }
  private remember(requestId: string): void {
    this.applied.add(requestId); this.unacknowledged.delete(requestId);
    if (this.applied.size > 4096) this.applied.delete(this.applied.values().next().value!);
  }
  private deliver(requestId: string, command: Command): void {
    if (this.applied.has(requestId)) {
      this.unacknowledged.delete(requestId);
      if (this.leader) this.channel.postMessage({ v: 1, kind: 'ack', requestId });
      return;
    }
    if (this.leader) {
      if (command.type === 'create-diagram' && command.baseRevision !== this.revision) {
        this.remember(requestId); this.channel.postMessage({ v: 1, kind: 'reject', requestId, reason: 'Board changed before the diagram was applied' });
        this.onRejected(requestId, 'Board changed before the diagram was applied'); return;
      }
      reduce(this.state, command); this.activeAt = Date.now(); this.revision++;
      this.remember(requestId);
      this.channel.postMessage({ v: 1, kind: 'event', epoch: this.epoch, revision: this.revision, requestId, command });
      this.onChange(command, requestId);
    } else this.channel.postMessage({ v: 1, kind: 'command', requestId, command });
  }
  signal(signal: Omit<Signal, 'sender'>): void { this.channel.postMessage({ ...signal, v: 1, sender: this.id }); }
  private flush(): void { for (const pending of this.pending.splice(0)) this.send(pending.command, pending.requestId); }
  private broadcastSnapshot(target?: string): void {
    this.channel.postMessage({ v: 1, kind: 'snapshot', target, epoch: this.epoch, revision: this.revision, applied: [...this.applied], state: this.state });
  }
  private receive(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const m = data as Record<string, unknown>;
    if (m.v !== 1) return;
    if (m.kind === 'hello' && this.leader && typeof m.sender === 'string') this.broadcastSnapshot(m.sender);
    if (m.kind === 'ack' && typeof m.requestId === 'string') this.unacknowledged.delete(m.requestId);
    if (m.kind === 'reject' && typeof m.requestId === 'string' && typeof m.reason === 'string' && this.unacknowledged.has(m.requestId)) {
      this.unacknowledged.delete(m.requestId); this.onRejected(m.requestId, m.reason);
    }
    if (m.kind === 'command' && this.leader && typeof m.requestId === 'string' && m.requestId.length < 100 && validCommand(m.command)) this.deliver(m.requestId, m.command);
    if (m.kind === 'snapshot' && !this.leader && (!m.target || m.target === this.id) && typeof m.epoch === 'string' && Number.isInteger(m.revision) && validState(m.state)) {
      if (m.epoch === this.epoch && (m.revision as number) < this.revision) return;
      if (!Array.isArray(m.applied) || m.applied.length > 4096 || !m.applied.every(id => typeof id === 'string' && id.length < 100)) return;
      this.state = m.state; this.epoch = m.epoch; this.revision = m.revision as number;
      this.state.settings.smartShapes ??= true;
      this.state.settings.autoConvertShapes ??= false;
      this.state.settings.confirmationHoldMs ??= 400;
      this.state.settings.shapeEditMode ??= 'scale';
      this.state.settings.shapeResizeMode ??= 'proportional';
      this.state.settings.penGripHoldMs ??= 180;
      this.state.settings.recognitionMode ??= 'shapes';
      this.state.settings.lassoGesture ??= 'four-fingertip';
      this.state.settings.lassoHoldMs ??= 220;
      this.state.settings.reactionsEnabled ??= true;
      this.state.settings.reactionSlots ??= defaults().reactionSlots;
      this.state.settings.reactionIntensity ??= 'normal';
      this.state.settings.reactionDurationMs ??= 2500;
      this.state.settings.objectGestureMode ??= 'move';
      this.state.settings.spatialTransformHoldMs ??= 220;
      this.state.settings.spatialScaleGain ??= 1.5;
      this.state.settings.spatialSmoothing ??= .35;
      this.state.settings.spatialScaleDeadZone ??= .03;
      this.state.settings.spatialRotationDeadZoneDeg ??= 3;
      this.state.settings.fistDepthNear ??= .24;
      this.state.settings.fistDepthFar ??= .14;
      this.applied = new Set(m.applied as string[]);
      for (const id of this.applied) this.unacknowledged.delete(id);
      this.ready = true; this.onChange(); this.flush();
    }
    if (m.kind === 'event' && !this.leader && typeof m.requestId === 'string' && m.requestId.length < 100 && validCommand(m.command) && Number.isInteger(m.revision)) {
      if (m.epoch === this.epoch && (m.revision as number) <= this.revision) return;
      if (!this.ready || m.epoch !== this.epoch || m.revision !== this.revision + 1) {
        this.ready = false; this.channel.postMessage({ v: 1, kind: 'hello', sender: this.id }); return;
      }
      reduce(this.state, m.command); this.remember(m.requestId); this.revision = m.revision as number; this.onChange(m.command, m.requestId);
    }
    if (['camera-request', 'camera-status', 'export-request'].includes(String(m.kind)) && typeof m.sender === 'string') this.onSignal(m as Signal);
    if (m.kind === 'reaction' && typeof m.sender === 'string' && validReactionEvent(m.event)) this.onSignal(m as Signal);
  }
  close(): void { clearInterval(this.retry); this.abort.abort(); this.release?.(); this.channel.close(); }
}
