import { test, expect, type Page } from '@playwright/test';
async function ready(page: Page, route = '/'): Promise<void> {
  await page.goto(route);
  await expect(page.locator('#drawing')).toBeVisible();
  // A harmless setting round-trip proves the local sequencer is ready.
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pen', exact: true })).toHaveAttribute('aria-pressed', 'true');
}
async function line(page: Page, y = 0.4): Promise<void> {
  const box = (await page.locator('#drawing').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * y, { steps: 25 });
  await page.mouse.up();
}
async function alpha(page: Page, x = 800, y = 360): Promise<number> {
  return page.locator('#drawing').evaluate((canvas, p) => (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(p.x, p.y, 1, 1).data[3], { x, y });
}
test('mouse drawing, erasing, history and PNG export work with local requests only', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) external.push(request.url()); });
  await ready(page);
  await line(page);
  await expect.poll(() => alpha(page)).toBe(255);
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await line(page);
  await expect.poll(() => alpha(page)).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => alpha(page)).toBe(255);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => alpha(page)).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^saai-airboard-.*\.png$/);
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect(bytes.readUInt32BE(16)).toBe(1600); expect(bytes.readUInt32BE(20)).toBe(900);
  await page.getByRole('button', { name: 'Clear drawing', exact: true }).click();
  await expect.poll(() => alpha(page)).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(() => alpha(page)).toBe(255);
  expect(errors).toEqual([]); expect(external).toEqual([]);
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true });
});
test('highlighter has uniform opacity, transparent export omits background and local images load', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Highlighter', exact: true }).click();
  await line(page);
  expect(await alpha(page)).toBeGreaterThan(60);
  expect(await alpha(page)).toBeLessThan(85);
  const uniform = await alpha(page, 500, 360);
  expect(Math.abs(uniform - await alpha(page))).toBeLessThan(3);
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 16, 16);
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#image-upload').setInputFiles({ name: 'local.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect.poll(() => page.locator('#background').evaluate(c => [...(c as HTMLCanvasElement).getContext('2d')!.getImageData(800, 450, 1, 1).data])).toEqual([255, 0, 0, 255]);
  // The square image starts centered in contain mode; moving it right exposes the matte at x=400.
  await page.locator('[data-setting="positionX"]').first().evaluate(input => { (input as HTMLInputElement).value = '1'; });
  await page.locator('[data-setting="positionX"]').first().dispatchEvent('input');
  await expect.poll(() => page.locator('#background').evaluate(c => [...(c as HTMLCanvasElement).getContext('2d')!.getImageData(400, 450, 1, 1).data])).toEqual([24, 35, 31, 255]);
  await page.locator('[data-action="reset-image"]').first().click();
  await expect.poll(() => page.locator('#background').evaluate(c => [...(c as HTMLCanvasElement).getContext('2d')!.getImageData(400, 450, 1, 1).data])).toEqual([255, 0, 0, 255]);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Drawing only', exact: true }).click();
  const download = await pending; const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const encoded = Buffer.concat(chunks).toString('base64');
  const pixel = await page.evaluate(async data => {
    const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0); return [...ctx.getImageData(10, 10, 1, 1).data];
  }, encoded);
  expect(pixel).toEqual([0, 0, 0, 0]);
});
test('Studio and Presentation synchronize late join, commands, and leader failover', async ({ page, context }) => {
  await ready(page); await line(page);
  const present = await context.newPage(); await ready(present, '/present');
  await expect.poll(() => alpha(present)).toBe(255);
  await present.getByRole('button', { name: 'Eraser', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Eraser', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await present.getByRole('button', { name: 'Undo', exact: true }).click();
  await present.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => alpha(page)).toBe(0);
  await present.getByRole('button', { name: 'Redo', exact: true }).click();
  await present.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => alpha(page)).toBe(255);
  await page.close();
  await present.getByRole('button', { name: 'Pen', exact: true }).click();
  await line(present, 0.6);
  await expect.poll(() => alpha(present, 800, 540)).toBe(255);
  await present.screenshot({ path: 'test-results/presentation.png' });
});
test('classic worker loads local WASM/model and processes a blank frame', async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const worker = new Worker('/vendor/hand-worker.js');
    return await new Promise<{ ready: boolean; hands: number }>((resolve, reject) => {
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('worker timeout')); }, 30000);
      worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
      worker.onmessage = async event => {
        if (event.data.kind === 'error') { clearTimeout(timeout); worker.terminate(); reject(new Error(event.data.error)); }
        if (event.data.kind === 'ready') {
          const c = document.createElement('canvas'); c.width = 640; c.height = 360;
          const ctx = c.getContext('2d')!; ctx.fillStyle = '#ddd'; ctx.fillRect(0, 0, 640, 360);
          const bitmap = await createImageBitmap(c);
          worker.postMessage({ kind: 'frame', bitmap, timestamp: performance.now() }, [bitmap]);
        }
        if (event.data.kind === 'result') { clearTimeout(timeout); worker.terminate(); resolve({ ready: true, hands: event.data.landmarks.length }); }
      };
      worker.postMessage({ kind: 'init', base: location.origin });
    });
  });
  expect(result).toEqual({ ready: true, hands: 0 });
});
test('camera denial gives an actionable message without breaking drawing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('denied', 'NotAllowedError'); } });
  });
  await ready(page);
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.locator('#tracking-status')).toContainText('Camera permission was denied');
  await line(page); await expect.poll(() => alpha(page)).toBe(255);
});
test('Presentation controls hide and can be revealed with the keyboard', async ({ page }) => {
  await ready(page, '/present');
  await page.mouse.click(10, 10);
  await page.mouse.move(500, 500);
  await expect(page.locator('#presentation-controls')).toHaveClass(/controls-hidden/, { timeout: 10000 });
  await page.keyboard.press('t');
  await expect(page.locator('#presentation-controls')).not.toHaveClass(/controls-hidden/);
});
