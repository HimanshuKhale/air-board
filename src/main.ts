import './styles.css';
import { studio } from './ui/studio';
import { presentation } from './ui/presentation';
import { dialogs } from './ui/dialogs';
import { bindControls, updateControls } from './ui/controls';
import { BOARD } from './core/types';
import { cameraToCanvas, canvasToClient } from './core/coordinates';
import { BoardChannel } from './sync/channel';
import { DrawingEngine } from './drawing/engine';
import { BackgroundRenderer } from './background/renderer';
import { composite, savePng } from './export/compositor';
import { CameraSession } from './camera/session';
import type { HandPointer } from './input/gesture';
import { InputRouter } from './input/router';
import { RateCounter } from './debug/metrics';
import { drawDebug } from './ui/overlay';
import { PipelineDebug } from './debug/pipeline';
import { InteractionController } from './interaction/controller';
import { initialState, defaults } from './core/settings';
import { loadHandSettings, saveHandSettings } from './calibration/storage';
import { PlaneMapper } from './calibration/homography';
import { drawInteractionOverlay } from './ui/interaction-overlay';
import { currentObjects, currentStrokes } from './drawing/history';
import { recognizeStroke } from './drawing/recognition';
import { paintObject } from './drawing/objects';
import type { BoardObject } from './core/types';
import { SpeechController } from './ai/speech';
import { parseCommand } from './ai/commands';
import { executeIntent } from './ai/execute';

const isPresentation = location.pathname === '/present';
document.body.classList.toggle('is-presentation', isPresentation);
document.getElementById('app')!.innerHTML = (isPresentation ? presentation() : studio()) + dialogs();
if (!navigator.locks || !('BroadcastChannel' in window)) {
  document.getElementById('app')!.textContent = 'SAAI AirBoard needs a current Chrome or Edge browser on localhost (Web Locks and BroadcastChannel are required).';
  throw new Error('Required local browser APIs unavailable');
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = el<HTMLVideoElement>('camera-video');
const drawing = new DrawingEngine(el<HTMLCanvasElement>('drawing'));
const backgroundCanvas = el<HTMLCanvasElement>('background');
const overlayCanvas = el<HTMLCanvasElement>('overlay');
for (const canvas of [backgroundCanvas, overlayCanvas]) { canvas.width = BOARD.width; canvas.height = BOARD.height; }
const backgroundContext = backgroundCanvas.getContext('2d')!;
const overlayContext = overlayCanvas.getContext('2d')!;
const background = new BackgroundRenderer(video);
const initial = initialState(); initial.settings = loadHandSettings(defaults());
const bus = new BoardChannel(initial);
bus.onRejected = (requestId, reason) => { if (aiRequestIds.delete(requestId)) { aiStatus(`${reason}. Please repeat the command.`); aiLog(`Skipped: ${reason}.`); } };
const speech = new SpeechController();
const camera = new CameraSession(video, bus, isPresentation ? 'Presentation' : 'Studio');
const pipelineDebug = new PipelineDebug(camera);
const input = new InputRouter(drawing.canvas, bus);
const planeMapper = new PlaneMapper();
const interactions = new InteractionController({
  send: command => bus.send(command),
  routePinch: (point, phase) => input.hand(point, phase),
  endPinch: () => input.endHand(),
  map: (point, size, settings) => {
    const calibrated = planeMapper.map(point, settings.planePoints);
    return calibrated ? { x: calibrated.x * BOARD.width, y: calibrated.y * BOARD.height } : cameraToCanvas(point, size, BOARD, settings.background.mirror, settings.background.mode === 'camera' ? settings.background.fit : 'stretch');
  },
  getState: () => bus.state,
  previewMove: preview => drawing.setMovePreview(preview),
  toast,
  showPointer: (point, diameter, held, label) => {
    const client = canvasToClient(point, drawing.canvas.getBoundingClientRect(), BOARD);
    lastPointerTime = performance.now(); cursor.hidden = false;
    cursor.style.left = client.x + 'px'; cursor.style.top = client.y + 'px';
    const scaled = Math.max(12, diameter * drawing.canvas.getBoundingClientRect().width / BOARD.width);
    cursor.style.width = scaled + 'px'; cursor.style.height = scaled + 'px'; cursor.style.setProperty('--cursor-color', label === 'E' ? '#e16357' : bus.state.settings.brush.color);
    cursor.classList.toggle('held', held); cursor.classList.add('from-hand'); cursor.querySelector('span')!.textContent = label;
  },
});
const renderRate = new RateCounter(), trackingRate = new RateCounter();
let hand: HandPointer | null = null;
let lastTracking = 0, inferenceMs = 0, backgroundDirty = true, debug = false, controlsUntil = performance.now() + 6000;
let toastTimer = 0, lastMetrics = 0, lastPointerTime = 0;
let previousGeometry = '';
let previousPaused = bus.state.settings.paused;
let lastAiActionPosition = -1;
const aiRequestIds = new Set<string>();
const recentTranscripts = new Map<string, number>();
const aiStatus = (message: string) => { el('ai-status').textContent = message; };
const aiLog = (message: string) => { const row = document.createElement('li'); row.textContent = message; el('ai-log').prepend(row); while (el('ai-log').children.length > 20) el('ai-log').lastElementChild?.remove(); };
function runVoiceCommand(text: string, requestId = crypto.randomUUID()): void {
  if (el<HTMLSelectElement>('ai-mode').value !== 'commands') return;
  const key = text.trim().toLocaleLowerCase();
  if (!key || Date.now() - (recentTranscripts.get(key) ?? 0) < 15000) return;
  const intent = parseCommand(text, el<HTMLInputElement>('command-mode').checked);
  if (!intent) { aiStatus('No supported explicit command found. Say “AirBoard” first or enable Command Mode.'); return; }
  try {
    aiRequestIds.add(requestId);
    const message = executeIntent(bus, intent, requestId, () => window.confirm('Clear the entire board? This can be undone.'));
    recentTranscripts.set(key, Date.now()); aiStatus(message); aiLog(message);
  } catch (error) { aiRequestIds.delete(requestId); aiStatus(error instanceof Error ? error.message : 'Command failed.'); }
}
speech.onStatus = aiStatus;
speech.onTranscript = event => {
  el('ai-transcript').textContent = `${event.type === 'interim' ? 'Hearing' : 'Heard'}: ${event.text}`;
  if (event.type === 'final') runVoiceCommand(event.text);
};
document.addEventListener('click', event => {
  if ((event.target as Element).closest('[data-action="voice-panel"]')) el('voice-panel').hidden = !el('voice-panel').hidden;
});
el('voice-close').addEventListener('click', () => { el('voice-panel').hidden = true; });
el('mic-toggle').addEventListener('click', async () => {
  if (speech.listening) { speech.stop(); el('mic-toggle').textContent = 'Start microphone'; return; }
  if (el<HTMLSelectElement>('ai-mode').value !== 'commands') { aiStatus('Choose Commands mode first.'); return; }
  try { await speech.start(); el('mic-toggle').textContent = 'Stop microphone'; }
  catch (error) { speech.stop(); aiStatus(error instanceof Error ? error.message : 'Microphone unavailable.'); }
});
el('ai-mode').addEventListener('change', () => { if (el<HTMLSelectElement>('ai-mode').value !== 'commands') { speech.stop(); el('mic-toggle').textContent = 'Start microphone'; } });
el('send-command').addEventListener('click', () => runVoiceCommand(el<HTMLInputElement>('typed-command').value));
el('typed-command').addEventListener('keydown', event => { if (event.key === 'Enter') runVoiceCommand(el<HTMLInputElement>('typed-command').value); });
el('undo-ai').addEventListener('click', () => {
  if (lastAiActionPosition < 0 || bus.state.history.position !== lastAiActionPosition) { aiStatus('Undo newer board actions first, then try Undo Last AI Action.'); return; }
  bus.send({ type: 'undo' }); lastAiActionPosition = -1; aiStatus('Undid last AI action.');
});
let pendingShape: { strokeId: string; object: BoardObject; confidence: number } | null = null;
let shapeTimer = 0;
function dismissShape(): void { pendingShape = null; clearTimeout(shapeTimer); el('shape-suggestion').hidden = true; }
function acceptShape(): void {
  const candidate = pendingShape; dismissShape();
  if (candidate) bus.send({ type: 'replace-stroke', strokeId: candidate.strokeId, object: candidate.object });
}
el('shape-convert').addEventListener('click', acceptShape);
el('shape-keep').addEventListener('click', dismissShape);
const cursor = el<HTMLDivElement>('hand-cursor');
function toast(message: string): void {
  const target = el('toast'); target.textContent = message; target.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => target.classList.remove('visible'), 5500);
}
function reveal(): void { controlsUntil = performance.now() + 5500; el('presentation-controls')?.classList.remove('controls-hidden'); }
function releaseHand(): void {
  hand = null; interactions.reset(); input.endHand(); camera.hand = false;
  if (cursor.classList.contains('from-hand')) cursor.hidden = true;
  el('hand-dot')?.classList.remove('active');
}
async function listCameras(): Promise<void> {
  try {
    const devices = await camera.camera.list();
    for (const id of ['camera-select', 'present-camera-select']) {
      const select = el<HTMLSelectElement>(id); if (!select) continue;
      const selected = select.value;
      select.replaceChildren(new Option('Default camera', ''), ...devices.map((device, i) => new Option(device.label || `Camera ${i + 1}`, device.deviceId)));
      if ([...select.options].some(option => option.value === selected)) select.value = selected;
    }
  } catch (error) { toast(error instanceof Error ? error.message : String(error)); }
}
function selectedCamera(): string | undefined { return (el<HTMLSelectElement>(isPresentation ? 'present-camera-select' : 'camera-select')?.value) || undefined; }
async function exportBoard(transparent: boolean): Promise<void> {
  try {
    input.end();
    const s = bus.state.settings;
    if (!transparent && s.background.mode === 'camera' && !camera.camera.stream) {
      if (camera.remote) {
        bus.signal({ kind: 'export-request', target: camera.remote.sender, transparent: false });
        toast('Saving the camera board in ' + camera.remote.view + '. Check that window’s downloads.');
        return;
      }
      throw new Error('Start the camera before exporting a camera background, or choose Drawing only.');
    }
    await background.setImage(s.background.image);
    if (!transparent && s.background.mode === 'image' && !background.imageReady) throw new Error('Choose a background image before exporting.');
    drawing.render(bus.state.history);
    await savePng(composite(background, s.background, drawing.canvas, transparent), transparent);
    toast(transparent ? 'Transparent drawing saved.' : 'Board saved as PNG.');
  } catch (error) { toast(error instanceof Error ? error.message : String(error)); }
}
bindControls(bus, {
  startCamera: () => { void camera.start(selectedCamera()); },
  stopCamera: () => { bus.signal({ kind: 'camera-request' }); camera.stop(); },
  launch: () => {
    const wantsCamera = camera.active || camera.starting || !!camera.remote;
    const target = window.open('/present' + (wantsCamera ? '?camera=1&device=' + encodeURIComponent(selectedCamera() ?? '') : ''), 'saai-presentation');
    if (!target) { toast('Allow pop-ups for localhost to open the Presentation window.'); return; }
    target.focus();
  },
  export: transparent => { void exportBoard(transparent); },
  toast, interrupt: () => input.cancelDrawing(), reveal,
  calibratePlane: () => interactions.startPlaneCalibration(),
  resetPlane: () => { interactions.resetPlaneCalibration(); planeMapper.reset(); },
  calibrateStylus: () => interactions.startStylusCalibration(),
  resetStylus: () => interactions.resetStylusCalibration(),
});
bus.onChange = (command, requestId) => {
  drawing.invalidate(!command || !['begin', 'point'].includes(command.type));
  if (requestId && aiRequestIds.delete(requestId) && command && !['select', 'undo', 'redo'].includes(command.type)) lastAiActionPosition = bus.state.history.position;
  if (command?.type === 'replace-stroke' && pendingShape?.strokeId === command.strokeId) dismissShape();
  if (command?.type === 'end' && bus.state.settings.smartShapes) {
    const action = bus.state.history.actions.at(bus.state.history.position - 1);
    if (action?.kind === 'stroke' && action.stroke.id === command.id) {
      const match = recognizeStroke(action.stroke);
      if (match) {
        dismissShape(); pendingShape = { strokeId: action.stroke.id, ...match };
        el('shape-suggestion-label').textContent = `Clean ${match.object.type}?`;
        el('shape-suggestion').hidden = false;
        shapeTimer = window.setTimeout(() => {
          if (bus.leader && bus.state.settings.autoConvertShapes && match.confidence >= 0.9) acceptShape();
          else dismissShape();
        }, 3000);
      }
    }
  }
  if (!command || command.type === 'settings') {
    backgroundDirty = true;
    void background.setImage(bus.state.settings.background.image).then(() => { backgroundDirty = true; }).catch(() => toast('This background image could not be decoded.'));
    const s = bus.state.settings;
    const geometry = JSON.stringify([s.background.mirror, s.background.mode, s.background.fit, s.inputMode, s.dominantHand]);
    if (geometry !== previousGeometry) { previousGeometry = geometry; releaseHand(); }
    if (s.paused !== previousPaused) { previousPaused = s.paused; interactions.cancelActive(); input.endHand(); }
    video.style.transform = s.background.mirror ? 'scaleX(-1)' : '';
  }
  updateControls(bus);
  saveHandSettings(bus.state.settings);
  const welcome = el('board-welcome');
  if (welcome) welcome.hidden = !!bus.state.history.position || !!bus.state.history.active || bus.state.settings.background.mode !== 'blank';
};
bus.onSignal = signal => {
  camera.receive(signal);
  if (signal.kind === 'export-request' && signal.target === bus.id && camera.active) void exportBoard(signal.transparent === true);
};
camera.onStatus = message => {
  el('tracking-status').textContent = message;
  document.body.classList.toggle('camera-running', !!camera.camera.stream);
  el('camera-dot')?.classList.toggle('active', camera.active || !!camera.camera.stream);
  const placeholder = el('camera-placeholder');
  if (placeholder) {
    placeholder.hidden = !!camera.camera.stream;
    if (camera.remote) placeholder.querySelector('small')!.textContent = 'Active in ' + camera.remote.view + '. Start camera to move it here.';
    else placeholder.querySelector('small')!.textContent = 'Start your camera to get moving.';
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="start-camera"]')) button.disabled = camera.starting || camera.active;
  if (/denied|failed|unavailable|disconnected|stopped:|timed out/i.test(message)) toast(message);
  const hint = el('input-hint');
  if (hint) hint.textContent = camera.remote ? 'Hand control and live camera are in ' + camera.remote.view + '. Studio controls stay synchronized.' : 'Mouse & touch ready. Open your hand, then pinch to draw.';
};
camera.onStop = () => { releaseHand(); backgroundDirty = true; document.body.classList.remove('camera-running'); };
camera.onStarted = () => { void listCameras(); document.body.classList.add('camera-running'); };
camera.tracker.onResult = result => {
  pipelineDebug.receiveResult(result);
  const now = performance.now();
  lastTracking = now; inferenceMs = result.duration; trackingRate.tick(now);
  if (now - result.timestamp > 250 || document.hidden) { releaseHand(); return; }
  interactions.update(result, { width: video.videoWidth, height: video.videoHeight }, result.timestamp, bus.state.settings);
  hand = interactions.pointer; camera.hand = !!hand;
  el('hand-dot')?.classList.toggle('active', !!hand);
  if (!hand && cursor.classList.contains('from-hand')) cursor.hidden = true;
};
input.onPointer = (client, held, fromHand) => {
  lastPointerTime = performance.now();
  cursor.hidden = false;
  cursor.style.left = client.x + 'px'; cursor.style.top = client.y + 'px';
  const brush = bus.state.settings.brush;
  const size = Math.max(12, brush.size * drawing.canvas.getBoundingClientRect().width / BOARD.width);
  cursor.style.width = size + 'px'; cursor.style.height = size + 'px';
  cursor.style.setProperty('--cursor-color', brush.tool === 'eraser' ? '#e16357' : brush.color);
  cursor.classList.toggle('held', held); cursor.classList.toggle('from-hand', fromHand);
  cursor.querySelector('span')!.textContent = brush.tool === 'eraser' ? 'E' : brush.tool === 'highlighter' ? 'H' : '';
  const rect = drawing.canvas.getBoundingClientRect();
  if (client.y < rect.top + 65) reveal();
};
input.onActivity = reveal;
document.addEventListener('pointermove', event => {
  const rect = drawing.canvas.getBoundingClientRect();
  if (event.clientY < rect.top + 65 || (event.target as Element).closest('.presentation-controls')) reveal();
});
document.querySelectorAll<HTMLInputElement>('#debug-toggle,[data-pipeline-debug]').forEach(toggle => toggle.addEventListener('change', () => {
  debug = toggle.checked; pipelineDebug.setEnabled(debug);
  document.querySelectorAll<HTMLInputElement>('#debug-toggle,[data-pipeline-debug]').forEach(input => { input.checked = debug; });
  if (!debug) overlayContext.clearRect(0, 0, BOARD.width, BOARD.height);
}));
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseHand(); input.end(); } });
window.addEventListener('blur', releaseHand);
navigator.mediaDevices?.addEventListener('devicechange', () => { void listCameras(); });
window.addEventListener('pagehide', () => { speech.stop(); camera.close(); bus.close(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
let frame = 0;
function render(now: number): void {
  renderRate.tick(now);
  const s = bus.state.settings;
  if (backgroundDirty || (s.background.mode === 'camera' && camera.camera.stream)) { background.draw(backgroundContext, s.background); backgroundDirty = false; }
  drawing.render(bus.state.history);
  overlayContext.clearRect(0, 0, BOARD.width, BOARD.height);
  drawInteractionOverlay(overlayContext, interactions.visuals, currentStrokes(bus.state.history, interactions.visuals.movePreview), bus.state.selection, currentObjects(bus.state.history, interactions.visuals.movePreview));
  if (pendingShape) { overlayContext.save(); overlayContext.globalAlpha = 0.55; paintObject(overlayContext, pendingShape.object); overlayContext.restore(); }
  if (hand && now - lastTracking > 250) releaseHand();
  if (now - lastPointerTime > 1800) cursor.hidden = true;
  const calibrating = el<HTMLDialogElement>('settings-dialog').open;
  const metrics = `Tracking ${trackingRate.get()} fps · Render ${renderRate.get()} fps · Inference ${inferenceMs.toFixed(1)} ms`;
  if (debug || calibrating) drawDebug(overlayContext, hand, { width: video.videoWidth || 1280, height: video.videoHeight || 720 }, s, metrics);
  if (now - lastMetrics > 200) {
    lastMetrics = now;
    const interaction = interactions.diagnostics;
    pipelineDebug.interactionText = [
      `Dominant hand: ${interaction.dominantHand}; detected: ${interaction.detectedHands.join(', ') || 'none'}`,
      `Gesture: ${interaction.instantaneousGesture}; stable: ${interaction.stableGesture}; enter: ${Math.round(interaction.gestureEnterMs)} ms`,
      `Active interaction: ${interaction.interaction}; hand control: ${interaction.handControl}`,
      `Two-hand close: ${interaction.twoHandClose}; hold: ${Math.round(interaction.twoHandHeldMs)} ms`,
      `Lasso active: ${interaction.lassoActive}; selected strokes: ${interaction.selectedStrokeCount}; grabbed: ${interaction.grabbedStrokeId ?? 'none'}`,
      `Plane calibration: ${interaction.planeCalibrationActive ? 'active' : interaction.planeCalibrationValid ? 'valid' : 'not calibrated'}`,
      `Input mode: ${interaction.inputMode}; virtual nib: ${interaction.virtualNibPoint ? interaction.virtualNibPoint.x.toFixed(3) + ', ' + interaction.virtualNibPoint.y.toFixed(3) : 'none'}`,
      `Raw pointer: ${interaction.rawPoint ? interaction.rawPoint.x.toFixed(3) + ', ' + interaction.rawPoint.y.toFixed(3) : 'none'}`,
      `Mapped pointer: ${interaction.mappedPoint ? interaction.mappedPoint.x.toFixed(1) + ', ' + interaction.mappedPoint.y.toFixed(1) : 'none'}`,
    ].join('\n');
    pipelineDebug.render(s);
    if (calibrating) el('calibration-readout').textContent = hand ? `Hand detected · ${hand.phase} · pinch ratio ${hand.ratio.toFixed(2)}\nRaw index ${hand.raw.x.toFixed(3)}, ${hand.raw.y.toFixed(3)} · Smoothed ${hand.smooth.x.toFixed(3)}, ${hand.smooth.y.toFixed(3)}\n${metrics}\nModel detection/presence/tracking thresholds: ${camera.tracker.diagnostics.worker.threshold}. Per-frame detection confidence is not exposed.` : (camera.remote ? 'Calibration must run in the camera-owning ' + camera.remote.view + ' window.' : 'No hand detected. Open your hand in front of the camera. Pinching starts only after an open hand is seen.');
    if (camera.active) el('tracking-status').textContent = s.paused ? 'Hand input paused · mouse still available' : hand ? 'Hand detected · ' + hand.phase.replace('pinch', 'pinch ') : 'Tracking ready · raise one open hand';
    input.heartbeat();
  }
  if (isPresentation) {
    const focused = document.activeElement?.matches(':focus-visible') && document.activeElement?.closest('.presentation-controls');
    el('presentation-controls').classList.toggle('controls-hidden', s.autoHide && now > controlsUntil && !calibrating && !document.querySelector('dialog[open]') && !focused);
  }
  frame = requestAnimationFrame(render);
}
bus.onChange();
void listCameras();
frame = requestAnimationFrame(render);
window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true });
if (isPresentation && new URLSearchParams(location.search).get('camera') === '1') {
  const device = new URLSearchParams(location.search).get('device') || undefined;
  history.replaceState(null, '', '/present');
  // Let the initial board snapshot arrive before opening the camera.
  const timer = window.setInterval(() => { if (bus.ready) { clearInterval(timer); void camera.start(device); } }, 100);
}
