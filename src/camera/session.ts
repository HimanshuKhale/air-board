import { CameraManager, cameraError } from './manager';
import { HandTracker } from '../tracking/tracker';
import type { BoardChannel, Signal } from '../sync/channel';
export class CameraSession {
  readonly camera: CameraManager;
  readonly tracker = new HandTracker();
  active = false;
  starting = false;
  remote: { sender: string; view: string; at: number; hand: boolean } | null = null;
  onStatus: (message: string) => void = () => {};
  onStop: () => void = () => {};
  onStarted: () => void = () => {};
  private release?: () => void;
  private abort?: AbortController;
  private generation = 0;
  private heartbeat: ReturnType<typeof setInterval>;
  hand = false;
  constructor(readonly video: HTMLVideoElement, readonly bus: BoardChannel, readonly view: string) {
    this.camera = new CameraManager(video);
    this.tracker.onError = message => { this.stop(); this.onStatus('Tracking stopped: ' + message); };
    this.heartbeat = setInterval(() => {
      if (this.active) this.announce();
      if (this.remote && Date.now() - this.remote.at > 3500) { this.remote = null; if (!this.active) this.onStatus('Camera is off. Start camera to use hand control here.'); }
    }, 1000);
  }
  async start(deviceId?: string): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.starting = true;
    this.onStatus('Starting camera…');
    this.bus.signal({ kind: 'camera-request' });
    const abort = new AbortController(); this.abort = abort;
    try {
      await navigator.locks.request('saai-airboard-camera', { signal: abort.signal }, async () => {
        if (generation !== this.generation) return;
        try {
          await this.camera.start(deviceId);
          if (generation !== this.generation || !this.camera.stream) return;
          this.onStatus('Camera ready · loading local hand tracker…');
          this.onStarted();
          await this.tracker.start(this.video);
          if (generation !== this.generation) return;
          this.active = true; this.starting = false; this.remote = null;
          this.camera.stream?.getVideoTracks()[0]?.addEventListener('ended', () => {
            this.stop(); this.onStatus('Camera disconnected. Reconnect it and press Start camera.');
          }, { once: true });
          this.onStatus('Tracking ready · raise one open hand'); this.announce();
          await new Promise<void>(resolve => { this.release = resolve; });
        } catch (error) {
          if (generation === this.generation) { this.stop(); this.onStatus(cameraError(error)); }
        } finally { if (generation === this.generation) this.stop(); }
      });
    } catch (error) { if (!abort.signal.aborted) this.onStatus(cameraError(error)); }
  }
  stop(): void {
    this.generation++; this.abort?.abort(); this.abort = undefined;
    this.tracker.stop(); this.camera.stop(); this.release?.(); this.release = undefined;
    const wasActive = this.active || this.starting;
    this.active = false; this.starting = false; this.hand = false; this.onStop();
    if (wasActive) { this.bus.signal({ kind: 'camera-status', active: false, view: this.view, hand: false }); this.onStatus('Camera is off'); }
  }
  receive(signal: Signal): void {
    if (signal.kind === 'camera-request') this.stop();
    if (signal.kind === 'camera-status' && typeof signal.active === 'boolean' && typeof signal.view === 'string') {
      if (signal.active) {
        this.remote = { sender: signal.sender, view: signal.view, at: Date.now(), hand: signal.hand === true };
        this.onStatus('Camera active in ' + signal.view + (signal.hand ? ' · hand detected' : ' · waiting for hand'));
      } else if (this.remote?.sender === signal.sender) { this.remote = null; this.onStatus('Camera is off'); }
    }
  }
  announce(): void { this.bus.signal({ kind: 'camera-status', active: this.active, view: this.view, hand: this.hand }); }
  close(): void { this.stop(); clearInterval(this.heartbeat); }
}
