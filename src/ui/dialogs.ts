import { button } from './toolbar';
export function dialogs(): string {
  return `<dialog id="settings-dialog"><div class="dialog-heading"><div><p class="eyebrow">MAKE IT FEEL NATURAL</p><h2>Calibration & settings</h2></div><button type="button" data-action="close-settings" aria-label="Close settings">✕</button></div>
    <p class="dialog-intro">Finger mode uses pinch-to-write. Pen Writing follows an estimated virtual nib and uses a stable three-point writing grip as its explicit down/up clutch.</p>
    <div class="calibration-readout" id="calibration-readout">Start the camera to check your hand pointer.</div>
    <label class="check-field"><input type="checkbox" data-pipeline-debug> Show tracking diagnostics</label>
    <h3>Hand input</h3>
    <label class="field">Dominant hand<select data-setting="dominantHand"><option value="Right">Right</option><option value="Left">Left</option></select></label>
    <div class="dialog-actions compact"><button type="button" data-action="verify-right-hand">Verify physical Right</button><button type="button" data-action="verify-left-hand">Verify physical Left</button></div>
    <label class="field">Pointer mode<select data-setting="inputMode"><option value="finger">Finger</option><option value="pen">Pen Writing</option></select></label>
    <label class="field">Gesture sensitivity<select data-setting="gestureSensitivity"><option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="responsive">Responsive</option></select></label>
    <details><summary>Advanced gesture settings</summary>
      <label class="field">Open-palm hold (milliseconds)<input type="range" min="150" max="250" step="10" data-setting="openPalmHoldMs"></label>
      <label class="field">Palm eraser diameter<input type="range" min="30" max="160" step="2" data-setting="palmEraserSize"></label>
      <label class="field">Lasso close radius<input type="range" min="25" max="120" step="5" data-setting="lassoCloseRadius"></label>
      <label class="field">Lasso gesture<select data-setting="lassoGesture"><option value="four-fingertip">Four-fingertip pinch</option><option value="index-only">Index-only fallback</option></select></label>
      <label class="field">Lasso gesture hold (milliseconds)<input type="range" min="150" max="400" step="10" data-setting="lassoHoldMs"></label>
      <label class="field">Pen-grip hold (milliseconds)<input type="range" min="120" max="400" step="10" data-setting="penGripHoldMs"></label>
      <label class="field">Fist grab radius<input type="range" min="25" max="160" step="5" data-setting="fistGrabRadius"></label>
      <label class="field">Two-hand toggle hold (milliseconds)<input type="range" min="400" max="600" step="25" data-setting="twoHandHoldMs"></label>
      <label class="field">Two-hand proximity<input type="range" min="0.08" max="0.5" step="0.01" data-setting="twoHandProximity"></label>
      <label class="field">Approval gesture hold (milliseconds)<input type="range" min="300" max="500" step="25" data-setting="confirmationHoldMs"></label>
    </details>
    <h3>Pen Writing</h3>
    <p class="muted" data-stylus-status>Default virtual nib offset</p>
    <div class="dialog-actions">${button('calibrate-stylus', 'Calibrate stylus', 'settings')}${button('reset-stylus', 'Reset stylus', 'undo')}</div>
    <h3>Writing plane</h3>
    <p class="muted" data-plane-status>Not calibrated</p>
    <div class="dialog-actions">${button('calibrate-plane', 'Calibrate plane', 'settings')}${button('reset-plane', 'Reset plane', 'undo')}</div>
    <label class="field">Pointer response <span class="muted">Lower is smoother; higher is faster.</span><input type="range" min="0.1" max="1" step="0.05" data-setting="smoothing" aria-label="Pointer response"></label>
    <label class="field">Pinch close ratio<input type="range" min="0.1" max="0.38" step="0.01" data-setting="pinchClose" aria-label="Pinch close ratio"></label>
    <label class="field">Pinch release ratio<input type="range" min="0.4" max="0.8" step="0.01" data-setting="pinchOpen" aria-label="Pinch release ratio"></label>
    <label class="field">Pinch debounce (milliseconds)<input type="range" min="30" max="200" step="5" data-setting="debounceMs" aria-label="Pinch debounce"></label>
    <label class="check-field"><input type="checkbox" data-setting="mirror"> Mirror camera & hand pointer</label>
    <label class="check-field"><input type="checkbox" data-setting="autoHide"> Auto-hide Presentation controls</label>
    <h3>Smart shapes</h3>
    <label class="check-field"><input type="checkbox" data-setting="smartShapes"> Automatically clean confident strokes</label>
    <label class="field">Smart recognition<select data-setting="recognitionMode"><option value="shapes">Shapes</option><option value="digits">Digits 0–9</option><option value="mixed">Mixed (conservative)</option></select></label>
    <label class="field">Pen opacity<input type="range" min="0.05" max="1" step="0.05" data-setting="opacity" aria-label="Pen opacity"></label>
    <div class="dialog-actions">${button('reset-settings', 'Reset calibration', 'undo')}${button('close-settings', 'Done', 'chevron', 'class="primary"')}</div>
    <p class="shortcut-note">P Pen · H Highlighter · E Eraser · Ctrl+Z Undo · Ctrl+Y Redo · F Fullscreen · T Toolbar · Space Pause hand</p>
  </dialog>
  <dialog id="background-dialog"><div class="dialog-heading"><h2>Presentation background</h2><button type="button" data-action="close-background" aria-label="Close background">✕</button></div>
    <div class="background-tabs">${button('bg-blank', 'Board', 'board')}${button('bg-camera', 'Camera', 'camera')}${button('bg-image', 'Image', 'image')}</div>
    <label class="field">Board color<input type="color" data-setting="board-color" aria-label="Presentation board color"></label>
    <label class="field">Choose image<input type="file" id="present-image-upload" accept="image/png,image/jpeg,image/webp"></label>
    <label class="field">Fit<select data-setting="fit" aria-label="Presentation background fit"><option value="contain">Contain</option><option value="cover">Cover</option><option value="stretch">Stretch</option></select></label>
    <div data-image-controls hidden><label class="field">Image horizontal position<input type="range" min="0" max="1" step="0.01" data-setting="positionX" aria-label="Presentation image horizontal position"></label><label class="field">Image vertical position<input type="range" min="0" max="1" step="0.01" data-setting="positionY" aria-label="Presentation image vertical position"></label>${button('reset-image', 'Center image', 'undo')}</div>
    <label class="check-field"><input type="checkbox" data-setting="mirror"> Mirror camera & hand pointer</label>
    <label class="field">Camera dimming<input type="range" data-setting="dim" min="0" max="0.8" step="0.05" aria-label="Presentation camera dimming"></label>
    <label class="field">Camera<select id="present-camera-select" aria-label="Presentation camera"><option value="">Default camera</option></select></label>
    <div class="dialog-actions">${button('start-camera', 'Start selected camera', 'camera')}${button('close-background', 'Done', 'chevron', 'class="primary"')}</div>
  </dialog><dialog id="shapes-dialog"><div class="dialog-heading"><h2>Create a shape</h2><button type="button" data-action="close-shapes" aria-label="Close shapes">×</button></div><p class="dialog-intro">Choose a native shape. Select it to scale it or edit its points.</p><div class="shape-grid">${['triangle','square','rectangle','parallelogram','trapezoid','pentagon','hexagon','polygon','circle','ellipse','line','arrow'].map(shape => `<button type="button" data-create-shape="${shape}">${shape}</button>`).join('')}</div></dialog>
  <div id="shape-edit-bar" class="shape-edit-bar" hidden><b>Edit shape</b><button type="button" data-action="shape-scale">Scale</button><button type="button" data-action="shape-points">Points</button><button type="button" data-action="resize-proportional">Proportional</button><button type="button" data-action="resize-free">Free</button></div>
  <section id="voice-panel" class="voice-panel" hidden aria-label="AirBoard voice controls"><div class="voice-heading"><b>AirBoard Intelligence</b><button type="button" id="voice-close" aria-label="Close voice panel">×</button></div><p>Audio is sent to the local speech service only while listening. With the OpenAI provider, that service sends each audio segment to OpenAI. Camera and board images are never sent.</p><label class="field">Mode<select id="ai-mode"><option value="off">Off</option><option value="commands">Commands</option><option value="automatic" disabled>Automatic (coming later)</option></select></label><label class="check-field"><input id="command-mode" type="checkbox"> Command Mode (no wake phrase needed)</label><div class="voice-actions"><button type="button" id="mic-toggle">Start microphone</button><button type="button" id="undo-ai">Undo Last AI Action</button></div><label class="field">Type a command<input id="typed-command" type="text" maxlength="500" placeholder="AirBoard, create a flowchart with input, process and output"></label><button type="button" id="send-command">Run command</button><p id="ai-status" role="status">Microphone off</p><p id="ai-transcript" aria-live="polite"></p><ol id="ai-log" aria-label="AI action log"></ol></section><div id="shape-suggestion" class="shape-suggestion" hidden><span id="shape-suggestion-label"></span><span id="shape-countdown">8.0s</span><span id="shape-gesture-feedback">Left-hand V confirms · shaka cancels</span><button type="button" id="shape-convert">✌️ YES</button><button type="button" id="shape-keep">🤙 NO</button></div><div id="toast" class="toast" role="status"></div><div id="hand-cursor" class="hand-cursor" hidden><span></span></div>`;
}
