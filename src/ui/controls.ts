import type { Settings, Tool } from '../core/types';
import { defaults } from '../core/settings';
import type { BoardChannel } from '../sync/channel';
import { readLocalImage } from '../background/renderer';
export interface ControlsActions {
  startCamera(): void; stopCamera(): void; launch(): void; export(transparent: boolean): void;
  toast(message: string): void; interrupt(): void; reveal(): void;
  calibratePlane(): void; resetPlane(): void;
  calibrateStylus(): void; resetStylus(): void;
}
export function bindControls(bus: BoardChannel, actions: ControlsActions): void {
  const sendSettings = (patch: Partial<Settings>) => { actions.interrupt(); bus.send({ type: 'settings', patch }); };
  const dialog = (id: string) => document.getElementById(id) as HTMLDialogElement;
  const moveCursorToDialog = (target: HTMLDialogElement) => {
    const cursor = document.getElementById('hand-cursor')!;
    target.append(cursor);
    target.addEventListener('close', () => document.body.append(cursor), { once: true });
  };
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-action],[data-color],[data-size-preset],[data-board-color]');
    if (!button) return;
    const settings = bus.state.settings;
    const action = button.dataset.action;
    if (button.dataset.color) sendSettings({ brush: { ...settings.brush, color: button.dataset.color } });
    if (button.dataset.sizePreset) sendSettings({ brush: { ...settings.brush, size: Number(button.dataset.sizePreset) } });
    if (button.dataset.boardColor) sendSettings({ background: { ...settings.background, mode: 'blank', color: button.dataset.boardColor } });
    if (['pen', 'highlighter', 'eraser'].includes(action ?? '')) {
      const tool = action as Tool;
      sendSettings({ brush: { ...settings.brush, tool, size: tool === 'pen' ? 6 : tool === 'highlighter' ? 24 : 48 } });
    }
    switch (action) {
      case 'start-camera': actions.startCamera(); break;
      case 'stop-camera': actions.stopCamera(); break;
      case 'launch': actions.launch(); break;
      case 'undo': case 'redo': case 'clear': actions.interrupt(); bus.send({ type: action }); break;
      case 'export': actions.export(false); break;
      case 'export-transparent': actions.export(true); break;
      case 'fullscreen': void toggleFullscreen(actions.toast); break;
      case 'settings': actions.interrupt(); dialog('settings-dialog').showModal(); moveCursorToDialog(dialog('settings-dialog')); actions.reveal(); break;
      case 'close-settings': dialog('settings-dialog').close(); break;
      case 'background': actions.interrupt(); dialog('background-dialog').showModal(); moveCursorToDialog(dialog('background-dialog')); actions.reveal(); break;
      case 'close-background': dialog('background-dialog').close(); break;
      case 'bg-blank': case 'bg-camera': case 'bg-image':
        sendSettings({ background: { ...settings.background, mode: action.slice(3) as 'blank' | 'camera' | 'image' } });
        if (action === 'bg-image' && !settings.background.image) (document.getElementById('image-upload') ?? document.getElementById('present-image-upload'))?.click();
        break;
      case 'pause': sendSettings({ paused: !settings.paused }); break;
      case 'reset-image': sendSettings({ background: { ...settings.background, positionX: 0.5, positionY: 0.5 } }); break;
      case 'calibrate-plane': actions.calibratePlane(); dialog('settings-dialog').close(); break;
      case 'reset-plane': actions.resetPlane(); break;
      case 'calibrate-stylus': actions.calibrateStylus(); dialog('settings-dialog').close(); break;
      case 'reset-stylus': actions.resetStylus(); break;
      case 'reset-settings': {
        const d = defaults();
        sendSettings({ smoothing: d.smoothing, pinchClose: d.pinchClose, pinchOpen: d.pinchOpen, debounceMs: d.debounceMs, background: { ...settings.background, mirror: true } });
        break;
      }
    }
  });
  document.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const name = input.dataset.setting;
    if (!name) return;
    const s = bus.state.settings;
    switch (name) {
      case 'ink': sendSettings({ brush: { ...s.brush, color: input.value } }); break;
      case 'size': case 'opacity': sendSettings({ brush: { ...s.brush, [name]: Number(input.value) } }); break;
      case 'board-color': sendSettings({ background: { ...s.background, color: input.value, mode: 'blank' } }); break;
      case 'fit': sendSettings({ background: { ...s.background, fit: input.value as Settings['background']['fit'] } }); break;
      case 'mirror': sendSettings({ background: { ...s.background, mirror: input.checked } }); break;
      case 'dim': sendSettings({ background: { ...s.background, dim: Number(input.value) } }); break;
      case 'positionX': case 'positionY': sendSettings({ background: { ...s.background, [name]: Number(input.value) } }); break;
      case 'autoHide': sendSettings({ autoHide: input.checked }); break;
      case 'smartShapes': case 'autoConvertShapes': sendSettings({ [name]: input.checked }); break;
      case 'dominantHand': sendSettings({ dominantHand: input.value as Settings['dominantHand'] }); break;
      case 'inputMode': sendSettings({ inputMode: input.value as Settings['inputMode'] }); break;
      case 'gestureSensitivity': sendSettings({ gestureSensitivity: input.value as Settings['gestureSensitivity'] }); break;
      case 'openPalmHoldMs': case 'palmEraserSize': case 'lassoCloseRadius': case 'fistGrabRadius': case 'twoHandHoldMs': case 'twoHandProximity': sendSettings({ [name]: Number(input.value) }); break;
      case 'smoothing': case 'pinchClose': case 'pinchOpen': case 'debounceMs': sendSettings({ [name]: Number(input.value) }); break;
    }
  });
  document.querySelectorAll<HTMLInputElement>('input[type=file]').forEach(input => input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    try { const image = await readLocalImage(file); sendSettings({ background: { ...bus.state.settings.background, mode: 'image', image, positionX: 0.5, positionY: 0.5 } }); actions.toast('Background image loaded locally.'); }
    catch (error) { actions.toast(error instanceof Error ? error.message : String(error)); }
    input.value = '';
  }));
  window.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('input,select,textarea,[contenteditable]') || document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    let action: string | undefined;
    if (event.ctrlKey || event.metaKey) {
      if (key === 'z') action = event.shiftKey ? 'redo' : 'undo';
      if (key === 'y') action = 'redo';
    } else if (!event.altKey) action = ({ p: 'pen', h: 'highlighter', e: 'eraser', f: 'fullscreen', ' ': 'pause' } as Record<string, string>)[key];
    if (key === 't' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); actions.reveal(); return; }
    if (action) {
      event.preventDefault();
      if (event.repeat) return;
      if (action === 'fullscreen') void toggleFullscreen(actions.toast);
      else document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
    }
  });
}
export async function toggleFullscreen(toast: (message: string) => void): Promise<void> {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { toast('Use the mouse Fullscreen button or press F to enter fullscreen.'); }
}
export function updateControls(bus: BoardChannel): void {
  const { settings: s, history: h } = bus.state;
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    const action = button.dataset.action;
    const pressed = action === s.brush.tool || action === 'bg-' + s.background.mode || (action === 'pause' && s.paused);
    if (['pen', 'highlighter', 'eraser', 'bg-blank', 'bg-camera', 'bg-image', 'pause'].includes(action ?? '')) button.setAttribute('aria-pressed', String(pressed));
    if (action === 'undo') button.disabled = !h.position && !h.active;
    if (action === 'redo') button.disabled = h.position >= h.actions.length || !!h.active;
  });
  document.querySelectorAll<HTMLElement>('[data-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === s.brush.color)));
  document.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => {
    const key = input.dataset.setting!;
    const values: Record<string, string | number | boolean> = { ink: s.brush.color, size: s.brush.size, opacity: s.brush.opacity, 'board-color': s.background.color,
      fit: s.background.fit, mirror: s.background.mirror, dim: s.background.dim, positionX: s.background.positionX, positionY: s.background.positionY, smoothing: s.smoothing, pinchClose: s.pinchClose, pinchOpen: s.pinchOpen, debounceMs: s.debounceMs, autoHide: s.autoHide,
      dominantHand: s.dominantHand, inputMode: s.inputMode, gestureSensitivity: s.gestureSensitivity, openPalmHoldMs: s.openPalmHoldMs, palmEraserSize: s.palmEraserSize, lassoCloseRadius: s.lassoCloseRadius, fistGrabRadius: s.fistGrabRadius, twoHandHoldMs: s.twoHandHoldMs, twoHandProximity: s.twoHandProximity, smartShapes: s.smartShapes, autoConvertShapes: s.autoConvertShapes };
    if (input.type === 'checkbox') input.checked = Boolean(values[key]);
    else if (String(values[key]) !== input.value) input.value = String(values[key]);
  });
  document.querySelectorAll('[data-size]').forEach(output => { output.textContent = String(s.brush.size); });
  document.querySelectorAll<HTMLElement>('[data-image-controls]').forEach(section => { section.hidden = s.background.mode !== 'image'; });
  document.querySelectorAll<HTMLElement>('[data-stylus-status]').forEach(status => { status.textContent = s.stylusOffset.x || s.stylusOffset.y ? 'Offset calibrated and saved locally' : 'Default virtual nib offset'; });
  document.querySelectorAll<HTMLElement>('[data-plane-status]').forEach(status => { status.textContent = s.planePoints ? 'Calibrated · four camera-space corners saved locally' : 'Not calibrated'; });
}
