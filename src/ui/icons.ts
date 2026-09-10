const paths: Record<string, string> = {
  pen: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/>',
  highlighter: '<path d="m9 13 6 6 6-10-6-6zM9 13l-4 4 2 2 4-4M3 21h8"/>',
  eraser: '<path d="m13 3 8 8-10 10H7l-5-5zM7 11l8 8M11 21h10"/>',
  undo: '<path d="M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
  redo: '<path d="m16 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12" transform="translate(0 -2)"/>',
  clear: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  save: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  camera: '<rect x="3" y="6" width="13" height="13" rx="3"/><path d="m16 10 5-3v11l-5-3"/>',
  present: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-4 0h8M9 7l6 3-6 3z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 16h6"/>',
  hand: '<path d="M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v10a7 7 0 0 1-12 5l-5-6a2 2 0 0 1 3-3l2 2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
export function icon(name: string): string { return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.board}</svg>`; }
