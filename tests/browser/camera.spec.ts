import { test, expect } from '@playwright/test';
test('synthetic video transfers camera ownership and exports the mirrored frame locally', async ({ context, page }) => {
  const external: string[] = [];
  context.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await context.addInitScript(() => {
    // Deliberate synthetic source: no hardware permission or real webcam is involved.
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d')!;
      const paint = () => { ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 320, 360); ctx.fillStyle = '#0000ff'; ctx.fillRect(320, 0, 320, 360); };
      paint();
      const stream = canvas.captureStream(30);
      const timer = setInterval(paint, 33);
      const track = stream.getVideoTracks()[0], stop = track.stop.bind(track);
      track.stop = () => { clearInterval(timer); stop(); };
      return stream;
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.locator('#tracking-status')).toContainText('Tracking ready', { timeout: 35000 });
  // No detected hand must never cancel a simultaneous mouse stroke.
  const board = (await page.locator('#drawing').boundingBox())!;
  await page.mouse.move(board.x + board.width * 0.2, board.y + board.height * 0.4);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(board.x + board.width * (0.2 + step * 0.05), board.y + board.height * 0.4);
    await page.waitForTimeout(70);
  }
  await page.mouse.up();
  await expect.poll(() => page.locator('#drawing').evaluate(c => (c as HTMLCanvasElement).getContext('2d')!.getImageData(900, 360, 1, 1).data[3])).toBe(255);
  await page.locator('[data-action="bg-camera"]').first().click();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open presentation', exact: true }).click();
  const present = await popup;
  await expect(present.locator('#tracking-status')).toContainText('Tracking ready', { timeout: 35000 });
  await expect.poll(() => page.locator('#camera-video').evaluate(video => (video as HTMLVideoElement).srcObject === null)).toBe(true);
  await expect.poll(() => present.locator('#camera-video').evaluate(video => ((video as HTMLVideoElement).srcObject as MediaStream)?.getVideoTracks()[0]?.readyState)).toBe('live');
  await expect(page.locator('#tracking-status')).toContainText('Camera active in Presentation');
  await present.keyboard.press('t');
  const downloadPromise = present.waitForEvent('download');
  // Request from Studio, download must happen in the authoritative camera window.
  await page.getByRole('button', { name: 'Save PNG', exact: true }).click();
  const download = await downloadPromise;
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const pixels = await present.evaluate(async data => {
    const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return { left: [...ctx.getImageData(200, 450, 1, 1).data], right: [...ctx.getImageData(1400, 450, 1, 1).data], ink: [...ctx.getImageData(900, 360, 1, 1).data] };
  }, Buffer.concat(chunks).toString('base64'));
  expect(pixels.left[0]).toBe(0); expect(pixels.left[2]).toBeGreaterThan(200);
  expect(pixels.right[2]).toBe(0); expect(pixels.right[0]).toBeGreaterThan(200);
  // Dimming was 15%, and no presentation UI was composited into these pixels.
  expect(pixels.left[2]).toBeLessThan(230); expect(pixels.left[3]).toBe(255);
  expect(pixels.ink).toEqual([34, 92, 74, 255]);
  await present.keyboard.press('t');
  await present.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect.poll(() => present.locator('#camera-video').evaluate(video => (video as HTMLVideoElement).srcObject === null)).toBe(true);
  expect(external).toEqual([]);
});
