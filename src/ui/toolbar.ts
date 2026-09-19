import { icon } from './icons';
export const palette = ['#225c4a', '#202a35', '#3b6fe8', '#da5650', '#e5ad38', '#8b5ecb', '#ffffff'];
export const button = (action: string, label: string, symbol = action, extra = '') => `<button type="button" data-action="${action}" title="${label}" ${extra}>${icon(symbol)}<span>${label}</span></button>`;
export function toolbar(): string {
  return `<div class="tool-group">
    ${button('pen', 'Pen (P)', 'pen', 'aria-label="Pen"')}
    ${button('highlighter', 'Highlighter (H)', 'highlighter', 'aria-label="Highlighter"')}
    ${button('eraser', 'Eraser (E)', 'eraser', 'aria-label="Eraser"')}
  </div><div class="tool-divider"></div>
  <div class="palette" aria-label="Ink colors">${palette.map(color => `<button type="button" class="swatch" data-color="${color}" aria-label="Ink ${color}" title="Ink ${color}" style="--swatch:${color}"></button>`).join('')}</div>
  <label class="custom-ink" title="Custom ink color"><input type="color" data-setting="ink" aria-label="Custom ink color" value="#225c4a"></label>
  <div class="tool-divider"></div>
  <label class="size-label">Size <input type="range" min="1" max="100" value="6" data-setting="size" aria-label="Brush size"><output data-size>6</output></label>
  <div class="size-presets">${[4, 10, 24, 48].map(n => `<button type="button" data-size-preset="${n}" title="${n} pixel brush" aria-label="${n} pixel brush"><i style="width:${Math.min(n, 20)}px;height:${Math.min(n, 20)}px"></i></button>`).join('')}</div>
  <div class="tool-divider"></div><div class="tool-group compact">
  ${button('undo', 'Undo', 'undo')}${button('redo', 'Redo', 'redo')}${button('clear', 'Clear drawing', 'clear')}${button('voice-panel', 'Voice', 'settings')}
  </div>`;
}
