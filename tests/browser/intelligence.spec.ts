import { test, expect, type Page } from '@playwright/test';
const pixel = (page: Page, x: number, y: number) => page.locator('#drawing').evaluate((canvas, p) => (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(p.x, p.y, 1, 1).data[3], { x, y });
async function ready(page: Page, path = '/'): Promise<void> { await page.goto(path); await expect(page.locator('#drawing')).toBeVisible(); await page.getByRole('button', { name: 'Pen', exact: true }).click(); }
async function drawRectangle(page: Page): Promise<void> {
  const box = (await page.locator('#drawing').boundingBox())!, at = (x: number, y: number) => ({ x: box.x + box.width * x / 1600, y: box.y + box.height * y / 900 });
  await page.mouse.move(at(200, 200).x, at(200, 200).y); await page.mouse.down();
  for (const [x, y] of [[500, 200], [500, 400], [200, 400], [200, 200]]) await page.mouse.move(at(x, y).x, at(x, y).y, { steps: 15 });
  await page.mouse.up();
}
test('rough rectangle converts instantly, moves, erases, undoes, and exports as PNG', async ({ page }) => {
  await ready(page); await drawRectangle(page);
  await expect(page.locator('#shape-suggestion')).toBeHidden();
  expect(await pixel(page, 200, 300)).toBeGreaterThan(0);
  const box = (await page.locator('#drawing').boundingBox())!, at = (x: number, y: number) => ({ x: box.x + box.width * x / 1600, y: box.y + box.height * y / 900 });
  await page.keyboard.down('Shift'); await page.mouse.move(at(300, 300).x, at(300, 300).y); await page.mouse.down();
  await page.mouse.move(at(400, 300).x, at(400, 300).y, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Shift');
  await expect.poll(() => pixel(page, 300, 300)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Eraser', exact: true }).click();
  await page.mouse.click(at(300, 300).x, at(300, 300).y);
  await expect.poll(() => pixel(page, 300, 300)).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => pixel(page, 300, 300)).toBeGreaterThan(0);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Drawing only', exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toMatch(/\.png$/);
  const chunks: Buffer[] = []; for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const exportedAlpha = await page.evaluate(async encoded => {
    const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    return context.getImageData(300, 300, 1, 1).data[3];
  }, Buffer.concat(chunks).toString('base64'));
  expect(exportedAlpha).toBeGreaterThan(0);
});
test('rough circle converts instantly to an editable ellipse and undo restores ink', async ({ page }) => {
  await ready(page);
  const box = (await page.locator('#drawing').boundingBox())!, at = (x: number, y: number) => ({ x: box.x + box.width * x / 1600, y: box.y + box.height * y / 900 });
  const start = at(820, 450); await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (let i = 1; i <= 64; i++) { const p = at(700 + 120 * Math.cos(i * Math.PI / 32), 450 + 90 * Math.sin(i * Math.PI / 32)); await page.mouse.move(p.x, p.y); }
  await page.mouse.up();
  await expect(page.locator('#shape-suggestion')).toBeHidden();
  await expect.poll(() => pixel(page, 820, 450)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => pixel(page, 820, 450)).toBeGreaterThan(0);
});
test('shape palette free-resizes with a live handle and commits one undo action', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.locator('[data-create-shape="rectangle"]').click();
  await expect(page.locator('#shape-edit-bar')).toBeVisible();
  await page.locator('[data-action="resize-free"]').click();
  await expect(page.locator('[data-action="resize-free"]')).toHaveAttribute('aria-pressed', 'true');
  const alpha = () => page.locator('#drawing').evaluate(canvas => {
    const data = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 500, 400).data;
    let total = 0; for (let i = 3; i < data.length; i += 4) total += data[i]; return total;
  });
  const before = await alpha(), box = (await page.locator('#drawing').boundingBox())!;
  const at = (x: number, y: number) => ({ x: box.x + box.width * x / 1600, y: box.y + box.height * y / 900 });
  const start = at(310, 230), end = at(430, 320);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
  await expect.poll(alpha).not.toBe(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(alpha).toBe(before);
});
test('Digits mode replaces a confident handwritten 2 immediately and undo restores its ink', async ({ page }) => {
  await ready(page); await page.getByRole('button', { name: 'Calibration & settings', exact: true }).click();
  await page.locator('[data-setting="recognitionMode"]').selectOption('digits'); await page.getByRole('button', { name: 'Done', exact: true }).click();
  const box = (await page.locator('#drawing').boundingBox())!, at = (x: number, y: number) => ({ x: box.x + box.width * x / 1600, y: box.y + box.height * y / 900 });
  const vertices = [[280,230],[330,190],[430,200],[455,255],[410,315],[270,430],[465,430]];
  const start = at(vertices[0][0], vertices[0][1]); await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (const [x,y] of vertices.slice(1)) { const p=at(x,y); await page.mouse.move(p.x,p.y,{steps:10}); } await page.mouse.up();
  const alpha = () => page.locator('#drawing').evaluate(canvas => { const data=(canvas as HTMLCanvasElement).getContext('2d')!.getImageData(180,140,380,360).data; let total=0; for(let i=3;i<data.length;i+=4) total+=data[i]; return total; });
  const clean = await alpha(); await page.getByRole('button', { name: 'Undo', exact: true }).click(); const rough = await alpha();
  expect(rough).not.toBe(clean); await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect.poll(alpha).toBe(clean);
});
test('Hinglish commands create an atomic synchronized diagram and avoid duplicates', async ({ page, context }) => {
  await ready(page); await page.getByRole('button', { name: 'Voice', exact: true }).click();
  await page.locator('#ai-mode').selectOption('commands');
  await page.locator('#typed-command').fill('AirBoard, create a flowchart with data collection, model training and deployment');
  await page.locator('#send-command').click(); await expect(page.locator('#ai-status')).toContainText('Created 3 connected boxes');
  await expect.poll(() => pixel(page, 60, 100)).toBeGreaterThan(0);
  const present = await context.newPage(); await ready(present, '/present');
  await expect.poll(() => pixel(present, 60, 100)).toBeGreaterThan(0);
  await page.locator('#send-command').click();
  await expect(page.locator('#ai-log li')).toHaveCount(1);
  await page.close();
  await present.getByRole('button', { name: 'Voice', exact: true }).click();
  await present.locator('#ai-mode').selectOption('commands');
  await present.locator('#typed-command').fill('AirBoard, ek rectangle banao');
  await present.locator('#send-command').click(); await expect(present.locator('#ai-status')).toContainText('Created 1 rectangle');
  await expect.poll(() => pixel(present, 60, 100)).toBeGreaterThan(0);
});
test('destructive voice clear uses the separate pending confirmation while smart recognition stays instant', async ({ page }) => {
  await ready(page); await drawRectangle(page);
  expect(await pixel(page, 200, 300)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Voice', exact: true }).click(); await page.locator('#ai-mode').selectOption('commands');
  await page.locator('#typed-command').fill('AirBoard, clear board'); await page.locator('#send-command').click();
  await expect(page.locator('#shape-suggestion')).toBeVisible(); await expect(page.locator('#shape-suggestion-label')).toContainText('Clear the entire board');
  await page.locator('#shape-keep').click(); await expect(page.locator('#shape-suggestion')).toBeHidden(); expect(await pixel(page, 200, 300)).toBeGreaterThan(0);
  await page.locator('#typed-command').fill('AirBoard, clear'); await page.locator('#send-command').click();
  await page.locator('#shape-convert').click(); await expect(page.locator('#ai-status')).toContainText('Board cleared');
  await expect.poll(() => pixel(page, 200, 300)).toBe(0);
});
test('speech service failure leaves existing board usable', async ({ page }) => {
  await ready(page); await drawRectangle(page); await expect(page.locator('#shape-suggestion')).toBeHidden();
  await page.route('http://127.0.0.1:8787/api/health', route => route.abort());
  await page.getByRole('button', { name: 'Voice', exact: true }).click(); await page.locator('#ai-mode').selectOption('commands');
  await page.locator('#mic-toggle').click(); await expect(page.locator('#ai-status')).toContainText('Failed to fetch');
  expect(await pixel(page, 200, 300)).toBeGreaterThan(0);
});
test('only finalized mocked audio transcript commits after leader failover', async ({ page, context }) => {
  await ready(page);
  const present = await context.newPage();
  await present.addInitScript(() => {
    const fakeStream = { getTracks: () => [{ stop() {} }] };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => fakeStream });
    class FakeRecorder {
      static isTypeSupported() { return true; }
      state = 'inactive'; mimeType = 'audio/webm'; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(_stream: unknown, _options: unknown) {}
      start() { this.state = 'recording'; setTimeout(() => this.stop(), 100); }
      stop() { if (this.state !== 'recording') return; this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(200)], { type: 'audio/webm' }) }); this.onstop?.(); }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: FakeRecorder });
  });
  await present.route('http://127.0.0.1:8787/api/health', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify({ status: 'ok', provider: 'mock' }) }));
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested: (() => void) | undefined;
  const started = new Promise<void>(resolve => { requested = resolve; });
  await present.route('http://127.0.0.1:8787/api/transcribe', async route => {
    requested?.(); await held;
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/x-ndjson', body: '{"type":"interim","text":"AirBoard, create"}\n{"type":"final","text":"AirBoard, create a flowchart with input, process and output"}\n' });
  });
  await ready(present, '/present');
  await present.getByRole('button', { name: 'Voice', exact: true }).click(); await present.locator('#ai-mode').selectOption('commands');
  await present.locator('#mic-toggle').click(); await started;
  await page.close(); release?.();
  await expect(present.locator('#ai-transcript')).toContainText('Heard: AirBoard, create a flowchart');
  await expect.poll(() => pixel(present, 60, 100)).toBeGreaterThan(0);
  await present.locator('#mic-toggle').click();
  await expect(present.locator('#ai-log li')).toHaveCount(1);
});
