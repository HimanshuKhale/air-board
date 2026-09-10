import { captureDimensions, defaultDebug, emptyWorkerStats, MODEL_OPTIONS, type DebugOptions, type PreviewMessage, type TrackingResult, type WorkerReply, type WorkerStats } from './protocol';
export interface PipelineDiagnostics {
  model: 'stopped' | 'loading' | 'ready' | 'failed'; status: string;
  captured: number; transferred: number; results: number; skipped: number;
  captureWidth: number; captureHeight: number; captureMs: number;
  lastSentId: number; lastReceivedId: number; lastResultId: number;
  sentAt: number; lastError: string | null; worker: WorkerStats;
  options: typeof MODEL_OPTIONS; appliedThreshold: number;
}
const initialDiagnostics = (): PipelineDiagnostics => ({
  model: 'stopped', status: 'Frame was never received (camera not started)', captured: 0, transferred: 0, results: 0, skipped: 0,
  captureWidth: 0, captureHeight: 0, captureMs: 0, lastSentId: 0, lastReceivedId: 0, lastResultId: 0, sentAt: 0, lastError: null,
  worker: emptyWorkerStats(), options: { ...MODEL_OPTIONS }, appliedThreshold: 0.65,
});
export class HandTracker {
  private worker: Worker | null = null;
  private busy = false;
  private running = false;
  private generation = 0;
  private timer = 0;
  private lastVideoTime = -1;
  private lastStart = 0;
  private lastTimestamp = -1;
  private interval = 1000 / 25;
  private cancelInit?: () => void;
  private capture = document.createElement('canvas');
  private captureContext = this.capture.getContext('2d')!;
  debug: DebugOptions = defaultDebug();
  diagnostics = initialDiagnostics();
  onResult: (result: TrackingResult) => void = () => {};
  onPreview: (preview: PreviewMessage) => void = preview => preview.bitmap.close();
  onError: (message: string) => void = () => {};
  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    this.diagnostics = initialDiagnostics();
    this.diagnostics.model = 'loading'; this.diagnostics.status = 'Loading model; no frame sent';
    const generation = this.generation;
    const worker = new Worker('/vendor/hand-worker.js');
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const fail = (message: string) => {
        clearTimeout(timeout); this.cancelInit = undefined;
        this.diagnostics.model = 'failed'; this.diagnostics.lastError = message; this.diagnostics.status = 'Model initialization failed';
        reject(new Error(message));
      };
      const timeout = setTimeout(() => fail('Tracker initialization timed out. Check local model assets and reload.'), 30000);
      this.cancelInit = () => { clearTimeout(timeout); reject(new Error('Camera startup cancelled.')); };
      worker.onerror = event => fail(event.message || 'Worker failed to start.');
      worker.onmessageerror = () => fail('Worker readiness message could not be deserialized');
      worker.onmessage = event => {
        if (event.data.kind === 'ready') {
          clearTimeout(timeout); this.cancelInit = undefined;
          this.diagnostics.model = 'ready'; this.diagnostics.options = event.data.options;
          this.diagnostics.status = 'Model ready; waiting for video frame'; resolve();
        } else if (event.data.kind === 'error') fail(event.data.error);
      };
      worker.postMessage({ kind: 'init', base: location.origin });
    });
    if (generation !== this.generation) return;
    worker.onerror = event => this.fail(event.message || 'Tracking worker stopped.');
    worker.onmessageerror = () => this.fail('Worker reply could not be deserialized');
    worker.onmessage = event => {
      const message = event.data as WorkerReply;
      if (message.kind === 'preview') {
        if (generation !== this.generation || !this.debug.enabled || !this.debug.preview) message.bitmap.close();
        else this.onPreview(message);
        return;
      }
      if (generation !== this.generation) return;
      if (message.kind === 'received') {
        this.diagnostics.worker = message.stats; this.diagnostics.lastReceivedId = message.frameId;
        if (!this.diagnostics.results) this.diagnostics.status = 'Worker received frame; inference pending';
        return; // Receipt is not completion: keep the one-frame-in-flight lock.
      }
      if (message.kind === 'result') {
        this.busy = false;
        this.diagnostics.results++; this.diagnostics.worker = message.stats; this.diagnostics.lastResultId = message.frameId;
        this.diagnostics.status = message.status === 'zero-hands' ? 'Frame processed successfully, zero hands' : 'Frame processed successfully, hands detected';
        this.interval = Math.max(1000 / 30, Math.min(200, message.duration * 1.15));
        this.onResult(message);
      } else if (message.kind === 'error') {
        this.diagnostics.lastError = message.stage + ': ' + message.error;
        if (message.stage === 'preview') return;
        this.diagnostics.worker = message.stats;
        this.fail(message.error);
      }
    };
    this.running = true;
    const tick = async () => {
      if (!this.running || generation !== this.generation) return;
      const now = performance.now();
      if (this.busy && now - this.diagnostics.sentAt > 5000) {
        const reason = this.diagnostics.lastReceivedId < this.diagnostics.lastSentId ? 'Frame was never acknowledged by worker' : 'Frame received but processing timed out';
        this.fail(reason); return;
      }
      if (!this.busy && video.readyState >= 2 && now - this.lastStart >= this.interval) {
        if (video.currentTime === this.lastVideoTime || video.videoWidth === 0 || video.videoHeight === 0) {
          this.diagnostics.skipped++;
        } else {
          this.busy = true; this.lastVideoTime = video.currentTime; this.lastStart = now;
          this.diagnostics.sentAt = now;
          let bitmap: ImageBitmap | null = null;
          try {
            const size = captureDimensions(video.videoWidth, video.videoHeight);
            const pipeline = this.debug.enabled ? this.debug.pipeline : 'canvas';
            if (pipeline === 'bitmap') {
              bitmap = await createImageBitmap(video, { resizeWidth: size.width, resizeHeight: size.height });
            } else {
              if (this.capture.width !== size.width || this.capture.height !== size.height) { this.capture.width = size.width; this.capture.height = size.height; }
              this.captureContext.setTransform(1, 0, 0, 1, 0, 0);
              this.captureContext.globalCompositeOperation = 'copy';
              this.captureContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, size.width, size.height);
              bitmap = await createImageBitmap(this.capture);
            }
            if (!this.running || generation !== this.generation) { bitmap.close(); return; }
            this.diagnostics.captured++; this.diagnostics.captureWidth = bitmap.width; this.diagnostics.captureHeight = bitmap.height;
            this.diagnostics.captureMs = performance.now() - now;
            if (!bitmap.width || !bitmap.height) throw new Error('Captured ImageBitmap has zero dimensions');
            const timestamp = Math.max(now, this.lastTimestamp + 0.001);
            this.lastTimestamp = timestamp;
            const frameId = this.diagnostics.captured;
            const threshold = this.debug.enabled ? this.debug.threshold : 0.65;
            worker.postMessage({ kind: 'frame', frameId, bitmap, timestamp, pipeline, threshold, preview: this.debug.enabled && this.debug.preview }, [bitmap]);
            bitmap = null; // Worker owns and closes the transferred bitmap.
            this.diagnostics.transferred++; this.diagnostics.lastSentId = frameId; this.diagnostics.appliedThreshold = threshold;
          } catch (error) {
            bitmap?.close();
            if (generation === this.generation) this.fail(error instanceof Error ? error.message : String(error));
          }
        }
      }
      if (this.running && generation === this.generation) this.timer = window.setTimeout(tick, 8);
    };
    void tick();
  }
  private fail(message: string): void {
    this.running = false; clearTimeout(this.timer);
    this.busy = false; this.diagnostics.model = 'failed'; this.diagnostics.lastError = message;
    this.diagnostics.status = 'Frame processing failed: ' + message; this.onError(message);
  }
  stop(): void {
    this.generation++; this.running = false; clearTimeout(this.timer);
    this.cancelInit?.(); this.cancelInit = undefined;
    this.worker?.terminate(); this.worker = null; this.busy = false; this.lastVideoTime = -1; this.lastTimestamp = -1;
    if (this.diagnostics.model !== 'failed') this.diagnostics.model = 'stopped';
  }
}
