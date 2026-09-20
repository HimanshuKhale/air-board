import { button, toolbar } from './toolbar';
export function presentation(): string {
  return `<main class="presentation-main">
    <div class="board" id="board"><canvas id="background" aria-hidden="true"></canvas><canvas id="drawing" aria-label="Teaching whiteboard. Draw with a mouse, touch, or pinch."></canvas><canvas id="overlay" aria-hidden="true"></canvas><div id="reaction-layer" class="reaction-layer" aria-live="polite" aria-label="Live reactions"></div></div>
    <video id="camera-video" muted playsinline class="hidden-video"></video>
    <div class="reveal-edge" id="reveal-edge" aria-hidden="true"></div>
    <div class="presentation-controls" id="presentation-controls">
      <div class="presentation-top"><a href="/studio" target="saai-studio" class="presentation-brand">SAAI <b>AirBoard</b></a><span id="tracking-status" role="status">Camera is off</span>
      ${button('start-camera', 'Start camera', 'camera')}${button('stop-camera', 'Stop', 'pause')}${button('pause', 'Pause hand input', 'pause')}${button('fullscreen', 'Fullscreen (F)', 'fullscreen')}${button('settings', 'Settings', 'settings')}</div>
      <div class="toolbar presentation-toolbar" id="toolbar" aria-label="Drawing tools">${toolbar()}${button('export', 'Save PNG', 'save')}${button('export-transparent', 'Drawing only', 'save')}${button('background', 'Background', 'board')}</div>
      <p class="presentation-help">Move to the top edge or press T to reveal tools. · Camera processing happens locally on this device. Video is not uploaded or recorded.</p>
    </div>
  </main>`;
}
