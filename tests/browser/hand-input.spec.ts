import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
test('generic hand pointer hovers, latches UI activation, draws and releases safely', async ({ page }) => {
  // Bundle the real router into the test harness only; production exposes no debug input API.
  const harness = await build({
    stdin: { contents: `
      import { InputRouter } from './src/input/router';
      import { initialState } from './src/core/settings';
      import { reduce } from './src/sync/protocol';
      window.createHandHarness = () => {
        const state = initialState(), commands = [];
        const bus = { state, ready: true, send(command) { commands.push(command); reduce(state, command); } };
        const router = new InputRouter(document.getElementById('drawing'), bus);
        window.handHarness = { router, commands, state };
      };
    `, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', platform: 'browser',
  });
  await page.addInitScript({ content: harness.outputFiles[0].text });
  await page.goto('/present');
  const result = await page.evaluate(() => {
    const w = window as unknown as {
      createHandHarness(): void;
      handHarness: { router: { hand(point: { x: number; y: number }, phase: string): void; end(): void }; commands: { type: string }[]; state: { history: { actions: unknown[]; active: unknown } } };
    };
    w.createHandHarness();
    const h = w.handHarness;
    h.router.hand({ x: 300, y: 300 }, 'hover');
    const hoverCount = h.commands.length;
    h.router.hand({ x: 300, y: 300 }, 'pinchStart');
    h.router.hand({ x: 400, y: 310 }, 'pinchHold');
    h.router.hand({ x: 400, y: 310 }, 'pinchEnd');
    const commands = h.commands.map(command => command.type);
    h.router.hand({ x: 500, y: 400 }, 'pinchStart'); h.router.end();
    const stopped = h.state.history.active === null;
    const button = document.querySelector<HTMLButtonElement>('[data-action="eraser"]')!;
    let clicks = 0; button.addEventListener('click', () => clicks++);
    const rect = button.getBoundingClientRect(), board = document.getElementById('drawing')!.getBoundingClientRect();
    const point = { x: (rect.x + rect.width / 2 - board.x) * 1600 / board.width, y: (rect.y + rect.height / 2 - board.y) * 900 / board.height };
    const before = h.commands.length;
    h.router.hand(point, 'pinchStart');
    h.router.hand(point, 'pinchHold'); h.router.hand(point, 'pinchHold');
    h.router.hand({ x: 600, y: 400 }, 'pinchHold');
    h.router.hand(point, 'pinchEnd');
    return { hoverCount, commands, stopped, clicks, uiCommands: h.commands.length - before };
  });
  expect(result).toEqual({ hoverCount: 0, commands: ['begin', 'point', 'end'], stopped: true, clicks: 1, uiCommands: 0 });
});
