import { button, toolbar } from './toolbar';
import { icon } from './icons';
export function studio(): string {
  return `<header class="app-header">
    <a href="/studio" class="brand"><b class="brand-mark">A</b><span><strong>SAAI <em>AirBoard</em></strong><small>TEACHING, UNTETHERED</small></span></a>
    <nav><span class="nav-active">Studio</span><a href="/present" target="saai-presentation">Presentation</a></nav>
    <div class="header-actions"><span class="local-badge"><i></i> Local & private</span>${button('launch', 'Open presentation', 'present', 'class="primary"')}</div>
  </header>
  <main class="studio-main">
    <section class="workspace">
      <div class="workspace-heading"><div><p class="eyebrow">YOUR TEACHING SPACE</p><h1>A little space for big ideas.</h1></div><span class="board-label">16:9 board <span>·</span> 1600 × 900</span></div>
      <div class="board-shell"><div class="board" id="board">
        <canvas id="background" aria-hidden="true"></canvas><canvas id="drawing" aria-label="Teaching whiteboard. Draw with a mouse, touch, finger pinch, or Pen Writing grip."></canvas><canvas id="overlay" aria-hidden="true"></canvas><div id="reaction-layer" class="reaction-layer" aria-live="polite" aria-label="Live reactions"></div>
        <div class="board-welcome" id="board-welcome"><span class="welcome-icon">${icon('pen')}</span><h2>Your next idea starts here.</h2><p>Use Finger mode, or choose Pen Writing for a physical pen grip.</p><span>FINGER PINCH OR PEN GRIP <b>·</b> RELEASE TO MOVE</span></div>
      </div>
      <div class="toolbar studio-toolbar" id="toolbar" aria-label="Drawing tools">${toolbar()}${button('export', 'Save', 'save', 'class="gesture-extra"')}${button('settings', 'Settings', 'settings', 'class="gesture-extra"')}${button('background', 'Background', 'board', 'class="gesture-extra"')}</div></div>
      <div class="board-footer"><span id="input-hint">Mouse & touch ready. Start the camera for hand control.</span><div>${button('export', 'Save PNG', 'save')}${button('export-transparent', 'Drawing only', 'save')}</div></div>
      <div class="quick-guide"><div><span>01</span><p><b>Set your scene</b>Choose a board, image, or camera.</p></div><div><span>02</span><p><b>Make your point</b>Pinch in Finger mode, or hold the Pen Writing grip.</p></div><div><span>03</span><p><b>Share your ideas</b>Open Presentation and share that window.</p></div></div>
    </section>
    <aside class="sidebar">
      <section class="panel camera-panel"><div class="panel-heading"><h2>${icon('camera')} Camera & hand control</h2><span class="status-dot" id="camera-dot"></span></div>
        <div class="camera-preview"><video id="camera-video" muted playsinline></video><div id="camera-placeholder">${icon('hand')}<span>Your hands. Your whiteboard.</span><small>Start your camera to get moving.</small></div></div>
        <label class="field">Camera<select id="camera-select" aria-label="Camera"><option value="">Default camera</option></select></label>
        <div class="camera-buttons">${button('start-camera', 'Start camera', 'camera', 'class="primary"')}${button('stop-camera', 'Stop', 'pause')}</div>
        <div class="tracking-status"><i id="hand-dot"></i><span id="tracking-status" role="status">Camera is off</span></div>
        <p class="privacy">Camera processing happens locally on this device. Video is not uploaded or recorded.</p>
      </section>
      <section class="panel"><div class="panel-heading"><h2>${icon('board')} Background</h2></div>
        <div class="background-tabs">${button('bg-blank', 'Board', 'board')}${button('bg-camera', 'Camera', 'camera')}${button('bg-image', 'Image', 'image')}</div>
        <div class="background-presets"><button type="button" data-board-color="#ffffff"><i class="white-board"></i>Whiteboard</button><button type="button" data-board-color="#172922"><i class="black-board"></i>Blackboard</button><label title="Custom board color"><input type="color" data-setting="board-color" value="#ffffff" aria-label="Custom board color"><span>Custom</span></label></div>
        <label class="upload-area">${icon('image')}<span><b>Choose a background image</b><small>PNG, JPG or WebP · up to 10 MB</small></span><input id="image-upload" type="file" accept="image/png,image/jpeg,image/webp"></label>
        <label class="field inline-field">Image / camera fit<select data-setting="fit" aria-label="Background fit"><option value="contain">Contain</option><option value="cover">Cover</option><option value="stretch">Stretch</option></select></label>
        <div data-image-controls hidden><label class="field">Image horizontal position<input type="range" min="0" max="1" step="0.01" data-setting="positionX" aria-label="Image horizontal position"></label><label class="field">Image vertical position<input type="range" min="0" max="1" step="0.01" data-setting="positionY" aria-label="Image vertical position"></label>${button('reset-image', 'Center image', 'undo')}</div>
        <label class="check-field"><input type="checkbox" data-setting="mirror" checked> Mirror camera & hand pointer</label>
        <label class="field dim-field">Camera dimming<input type="range" data-setting="dim" min="0" max="0.8" step="0.05" value="0.15" aria-label="Camera dimming"></label>
      </section>
      <section class="panel settings-panel">${button('settings', 'Calibration & settings', 'settings')}${button('pause', 'Pause hand input', 'pause')}<label class="check-field"><input type="checkbox" id="debug-toggle"> Show tracking diagnostics</label></section>
    </aside>
  </main><footer class="app-footer"><span>SAAI AirBoard <span class="muted">/ A calmer way to teach.</span></span><span>Processed on your device. Designed for your classroom.</span></footer>`;
}
