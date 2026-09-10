import type { CameraSession } from '../camera/session';
import type { Settings } from '../core/types';
import { cameraToCanvas } from '../core/coordinates';
import type { PreviewMessage, TrackingResult } from '../tracking/protocol';
const edges = [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
/** Debug-only DOM/canvases. No board state, drawing pixels, persistence or network use. */
export class PipelineDebug {
  enabled = false;
  private panel = document.createElement('section');
  private output = document.createElement('pre');
  private snapshot = document.createElement('canvas');
  private snapshotInfo = document.createElement('p');
  private snapshotArea = document.createElement('div');
  private landmarks = document.createElement('canvas');
  private showLandmarks = false;
  private cameraComparison: HTMLCanvasElement | null = null;
  private result: TrackingResult | null = null;
  private resultAt = 0;
  private videoCallback = 0;
  private observedStream: MediaProvider | null = null;
  private meterStart = 0;
  private meterFrames = 0;
  private fps: number | null = null;
  private lastVideoFrameAt = 0;
  private snapshotAt = 0;
  private snapshotFingerprint: number | null = null;
  private unchangedSince = 0;
  private lastTrack = { label: 'Unavailable', width: 0, height: 0, frameRate: 0 };
  constructor(private camera: CameraSession) {
    this.panel.id = 'pipeline-debug'; this.panel.className = 'panel'; this.panel.hidden = true;
    this.panel.innerHTML = `<h2>Camera → worker → MediaPipe</h2>
      <label class="check-field"><input type="checkbox" id="worker-preview-toggle"> Worker Input Preview</label>
      <label class="check-field"><input type="checkbox" id="mediapipe-landmarks-toggle"> Show MediaPipe landmarks</label>
      <label class="field">Diagnostic thresholds (temporary)
        <select id="pipeline-threshold" aria-label="Diagnostic thresholds"><option value="0.65">Original: 0.65</option><option value="0.5">Test: 0.50</option><option value="0.35">Test: 0.35</option></select>
      </label>
      <label class="field">Capture / inference path
        <select id="pipeline-path" aria-label="Diagnostic pipeline"><option value="canvas">Canvas-normalized input</option><option value="bitmap">Original direct ImageBitmap (comparison)</option></select>
      </label>`;
    this.output.id = 'pipeline-readout';
    this.output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.6;margin-top:12px';
    this.snapshot.id = 'worker-input-preview'; this.snapshot.width = 240; this.snapshot.height = 135;
    this.snapshot.style.cssText = 'display:block;max-width:100%;height:auto';
    this.snapshotArea.hidden = true;
    const caption = document.createElement('p');
    caption.textContent = 'Raw worker input (unmirrored). Camera preview may be mirrored. Snapshot ~1.5 FPS; not saved.';
    caption.style.cssText = 'font-size:11px;margin:8px 0';
    this.snapshotInfo.id = 'worker-preview-info'; this.snapshotInfo.style.cssText = 'font-size:11px;white-space:pre-wrap';
    this.snapshotArea.append(caption, this.snapshot, this.snapshotInfo);
    this.panel.append(this.output, this.snapshotArea);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.insertBefore(this.panel, sidebar.children[1] ?? null);
    else {
      this.panel.style.cssText = 'position:fixed;right:12px;top:12px;z-index:20;width:360px;max-width:95vw;max-height:90vh;overflow:auto';
      document.body.append(this.panel);
    }
    const preview = document.querySelector('.camera-preview');
    this.landmarks.id = 'camera-landmarks';
    this.landmarks.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
    this.landmarks.hidden = true;
    if (preview) preview.append(this.landmarks);
    else {
      const title = document.createElement('p'); title.textContent = 'Local camera preview';
      const holder = document.createElement('div'); holder.style.cssText = 'position:relative;width:240px;height:135px';
      this.cameraComparison = document.createElement('canvas'); this.cameraComparison.width = 240; this.cameraComparison.height = 135;
      holder.append(this.cameraComparison, this.landmarks);
      this.panel.insertBefore(title, this.output); this.panel.insertBefore(holder, this.output);
    }
    this.panel.querySelector<HTMLInputElement>('#worker-preview-toggle')!.onchange = event => {
      const checked = (event.target as HTMLInputElement).checked;
      camera.tracker.debug.preview = checked; this.snapshotArea.hidden = !checked;
      if (!checked) this.clearSnapshot();
    };
    this.panel.querySelector<HTMLInputElement>('#mediapipe-landmarks-toggle')!.onchange = event => {
      this.showLandmarks = (event.target as HTMLInputElement).checked;
      this.landmarks.hidden = !this.showLandmarks;
    };
    this.panel.querySelector<HTMLSelectElement>('#pipeline-threshold')!.onchange = event => {
      camera.tracker.debug.threshold = Number((event.target as HTMLSelectElement).value) as 0.65 | 0.5 | 0.35;
    };
    this.panel.querySelector<HTMLSelectElement>('#pipeline-path')!.onchange = event => {
      camera.tracker.debug.pipeline = (event.target as HTMLSelectElement).value as 'canvas' | 'bitmap';
      this.clearSnapshot();
    };
    camera.tracker.onPreview = preview => this.receivePreview(preview);
  }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled; this.panel.hidden = !enabled;
    this.camera.tracker.debug.enabled = enabled;
    this.landmarks.hidden = !enabled || !this.showLandmarks;
    if (!enabled) {
      this.stopMeter(); this.clearSnapshot();
      this.camera.tracker.debug.threshold = 0.65; this.camera.tracker.debug.pipeline = 'canvas';
      this.panel.querySelector<HTMLSelectElement>('#pipeline-threshold')!.value = '0.65';
      this.panel.querySelector<HTMLSelectElement>('#pipeline-path')!.value = 'canvas';
    }
  }
  receiveResult(result: TrackingResult): void { this.result = result; this.resultAt = performance.now(); }
  private receivePreview(message: PreviewMessage): void {
    try {
      if (!this.enabled || !this.camera.tracker.debug.preview) return;
      this.snapshot.width = message.bitmap.width; this.snapshot.height = message.bitmap.height;
      this.snapshot.getContext('2d')!.drawImage(message.bitmap, 0, 0);
      this.snapshot.dataset.frameId = String(message.frameId);
      this.snapshot.dataset.inputSize = message.width + 'x' + message.height;
      this.snapshotAt = performance.now();
      if (message.pixels.fingerprint !== this.snapshotFingerprint) this.unchangedSince = this.snapshotAt;
      this.snapshotFingerprint = message.pixels.fingerprint;
      const p = message.pixels;
      this.snapshotInfo.textContent = `Frame #${message.frameId} · ${message.width} × ${message.height} · ${message.pipeline}\nSnapshot ${new Date(message.capturedAt).toLocaleTimeString()}\nRGB mean ${p.mean.toFixed(1)}, range ${p.min.toFixed(0)}–${p.max.toFixed(0)}; alpha ${p.meanAlpha.toFixed(1)}/255\n${p.meanAlpha < 250 ? 'WARNING: transparent input pixels' : p.max - p.min < 3 ? 'Nearly uniform pixels: inspect for blank input' : 'Nonuniform pixels (not proof of a visible hand)'}`;
    } finally { message.bitmap.close(); }
  }
  private clearSnapshot(): void {
    this.snapshot.getContext('2d')!.clearRect(0, 0, this.snapshot.width, this.snapshot.height);
    this.snapshotInfo.textContent = 'Waiting for a worker snapshot…'; this.snapshotAt = 0;
    this.snapshotFingerprint = null; this.unchangedSince = 0;
    delete this.snapshot.dataset.frameId; delete this.snapshot.dataset.inputSize;
  }
  private stopMeter(): void {
    if (this.videoCallback) this.camera.video.cancelVideoFrameCallback?.(this.videoCallback);
    this.videoCallback = 0; this.observedStream = null; this.fps = null; this.meterStart = 0; this.lastVideoFrameAt = 0;
  }
  private meter(): void {
    const video = this.camera.video;
    if (video.srcObject === this.observedStream) return;
    this.stopMeter(); this.observedStream = video.srcObject;
    if (!video.srcObject || !video.requestVideoFrameCallback) return;
    const tick = (now: number, metadata: VideoFrameCallbackMetadata) => {
      this.lastVideoFrameAt = now;
      if (!this.meterStart) { this.meterStart = now; this.meterFrames = metadata.presentedFrames; }
      if (now - this.meterStart >= 1000) {
        this.fps = Math.max(0, (metadata.presentedFrames - this.meterFrames) * 1000 / (now - this.meterStart));
        this.meterStart = now; this.meterFrames = metadata.presentedFrames;
      }
      if (this.enabled && video.srcObject === this.observedStream) this.videoCallback = video.requestVideoFrameCallback(tick);
    };
    this.videoCallback = video.requestVideoFrameCallback(tick);
  }
  render(settings: Settings): void {
    if (!this.enabled) return;
    this.meter();
    const video = this.camera.video, d = this.camera.tracker.diagnostics, w = d.worker;
    const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (track) {
      const s = track.getSettings();
      this.lastTrack = { label: track.label, width: s.width ?? 0, height: s.height ?? 0, frameRate: s.frameRate ?? 0 };
    }
    const handedness = w.handedness.map((hand, index) => `#${index + 1}: ${hand.map(c => c.categoryName + ' ' + c.score.toFixed(3)).join(', ')}`).join('; ') || 'none';
    const now = performance.now();
    const pending = d.lastSentId > d.lastResultId
      ? (d.lastReceivedId < d.lastSentId ? `Frame #${d.lastSentId} transferred; receipt not yet acknowledged (${Math.round(now - d.sentAt)} ms)` : `Frame #${d.lastSentId} received; result pending`) : 'none';
    const observedFps = this.lastVideoFrameAt && now - this.lastVideoFrameAt > 1500 ? '0 (video stale)' : this.fps === null ? 'measuring / unavailable' : this.fps.toFixed(1);
    this.output.textContent = [
      `Owner: ${this.camera.remote ? this.camera.remote.view + ' (open debug there)' : track ? 'this window' : 'camera off'}`,
      `Camera track label: ${this.lastTrack.label}`,
      `Actual track width × height: ${this.lastTrack.width} × ${this.lastTrack.height}`,
      `Track-reported FPS: ${this.lastTrack.frameRate || 'unavailable'}`,
      `Observed camera FPS (rVFC): ${observedFps}`,
      `videoWidth / videoHeight: ${video.videoWidth} / ${video.videoHeight}`,
      `Video readyState: ${video.readyState}; currentTime: ${video.currentTime.toFixed(3)}`,
      `Model ready state: ${d.model}; delegate: ${d.options.delegate} (WASM; WebGL input upload)`,
      `runningMode: ${d.options.runningMode}; numHands: ${d.options.numHands}`,
      `Detection / presence / tracking: ${w.threshold} / ${w.threshold} / ${w.threshold}`,
      `Frames captured: ${d.captured}; transferred: ${d.transferred}; worker received: ${w.framesReceived}`,
      `Capture dimensions: ${d.captureWidth} × ${d.captureHeight}; capture: ${d.captureMs.toFixed(1)} ms`,
      `Actual worker input: ${w.inputWidth} × ${w.inputHeight}`,
      `Inference calls: ${w.inferenceCalls}; successful: ${w.successfulInferences}; failed frames: ${w.failedFrames}`,
      `Inference duration: ${w.duration.toFixed(1)} ms; results received: ${d.results}`,
      `Last completed outcome (#${d.lastResultId}): ${d.status}`,
      `In flight: ${pending}`,
      `Landmarks array count: ${w.landmarksArrayCount}; detected hand count: ${w.detectedHandCount}`,
      `Points per hand: [${w.landmarkCounts.join(', ')}]`,
      `Handedness: ${handedness} (scores are handedness confidence)`,
      'Hand detection confidence: not exposed by HandLandmarker JS; no substitute score',
      `Last worker/capture error: ${d.lastError ?? w.lastError ?? 'none'}`,
      `Last successful inference: ${w.lastSuccessAt ? new Date(w.lastSuccessAt).toISOString() : 'never'}`,
      `Preview age: ${this.snapshotAt ? ((now - this.snapshotAt) / 1000).toFixed(1) + ' s' : 'no snapshot'}`,
      `Identical sampled pixels: ${this.unchangedSince ? ((now - this.unchangedSince) / 1000).toFixed(1) + ' s (may be a stationary scene)' : 'unavailable'}`,
    ].join('\n');
    const holder = this.landmarks.parentElement!;
    const width = Math.max(1, holder.clientWidth), height = Math.max(1, holder.clientHeight);
    if (this.landmarks.width !== width || this.landmarks.height !== height) { this.landmarks.width = width; this.landmarks.height = height; }
    const ctx = this.landmarks.getContext('2d')!; ctx.clearRect(0, 0, width, height);
    if (this.cameraComparison && video.readyState >= 2) {
      const c = this.cameraComparison.getContext('2d')!; c.save();
      const scale = Math.max(240 / video.videoWidth, 135 / video.videoHeight);
      if (settings.background.mirror) { c.translate(240, 0); c.scale(-1, 1); }
      c.drawImage(video, (240 - video.videoWidth * scale) / 2, (135 - video.videoHeight * scale) / 2, video.videoWidth * scale, video.videoHeight * scale); c.restore();
    }
    if (!this.showLandmarks || !track || !this.result || now - this.resultAt > 500 || !video.videoWidth || !video.videoHeight) return;
    ctx.strokeStyle = '#18c8ed'; ctx.fillStyle = '#18c8ed'; ctx.lineWidth = 1.5;
    for (const hand of this.result.allLandmarks) {
      if (hand.length !== 21) continue;
      const points = hand.map(p => cameraToCanvas(p, { width: video.videoWidth, height: video.videoHeight }, { width, height }, settings.background.mirror, 'cover'));
      for (const edge of edges) {
        ctx.beginPath(); edge.forEach((index, i) => { const p = points[index]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.stroke();
      }
      points.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
    }
  }
}
