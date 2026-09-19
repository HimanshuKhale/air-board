import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('worker receives nonblank portrait pixels, preserves orientation, and distinguishes invalid frames from zero hands', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const worker = new Worker('/vendor/hand-worker.js');
    const events: Record<string, any>[] = [];
    const previews: { frameId: number; size: number[]; corners: number[][]; at: number }[] = [];
    const waiters: { accept: (data: any) => boolean; resolve: (data: any) => void }[] = [];
    worker.onmessage = event => {
      const data = event.data;
      if (data.kind === 'preview') {
        const c = document.createElement('canvas'); c.width = data.bitmap.width; c.height = data.bitmap.height;
        const ctx = c.getContext('2d')!; ctx.drawImage(data.bitmap, 0, 0); data.bitmap.close();
        previews.push({ frameId: data.frameId, size: [data.width, data.height], at: performance.now(),
          corners: [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([x, y]) => [...ctx.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data]) });
      } else events.push(data);
      for (const waiter of [...waiters]) if (waiter.accept(data)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(data); }
    };
    const wait = (accept: (data: any) => boolean): Promise<any> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Missing worker message')), 30000);
      waiters.push({ accept, resolve: data => { clearTimeout(timer); resolve(data); } });
    });
    const ready = wait(data => data.kind === 'ready'); worker.postMessage({ kind: 'init', base: location.origin }); await ready;
    const c = document.createElement('canvas'); c.width = 360; c.height = 640;
    const ctx = c.getContext('2d')!;
    for (const [color, x, y] of [['#ff0000', 0, 0], ['#00ff00', 180, 0], ['#0000ff', 0, 320], ['#ffffff', 180, 320]] as const) {
      ctx.fillStyle = color; ctx.fillRect(x, y, 180, 320);
    }
    const send = async (id: number, timestamp: number) => {
      const bitmap = await createImageBitmap(c);
      const reply = wait(data => (data.kind === 'result' || data.kind === 'error') && data.frameId === id);
      worker.postMessage({ kind: 'frame', frameId: id, bitmap, timestamp, preview: true }, [bitmap]);
      const detached = bitmap.width === 0;
      return { reply: await reply, detached };
    };
    const first = await send(1, 100);
    const second = await send(2, 200);
    const bad = await send(3, 200);
    const fourth = await send(4, 300);
    worker.terminate();
    return { first, second, bad, fourth, previews, receipts: events.filter(e => e.kind === 'received').length };
  });
  expect(result.first.detached).toBe(true);
  expect(result.first.reply.status).toBe('zero-hands');
  expect(result.first.reply.stats).toMatchObject({ framesReceived: 1, inferenceCalls: 1, successfulInferences: 1, inputWidth: 360, inputHeight: 640 });
  expect(result.previews[0].size).toEqual([360, 640]);
  expect(result.previews[0].corners).toEqual([[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]]);
  for (let i = 1; i < result.previews.length; i++) expect(result.previews[i].at - result.previews[i - 1].at).toBeGreaterThan(500);
  expect(result.bad.reply).toMatchObject({ kind: 'error', stage: 'frame', error: 'Frame timestamp is not strictly increasing' });
  expect(result.bad.reply.stats.inferenceCalls).toBe(2);
  expect(result.fourth.reply.stats).toMatchObject({ framesReceived: 4, inferenceCalls: 3, successfulInferences: 3, failedFrames: 1 });
  expect(result.receipts).toBe(4);
});

test('local known-hand fixture detects 21 landmarks through the normalized worker path at original thresholds', async ({ page }) => {
  const fixture = (await readFile('tests/fixtures/right_hands.jpg')).toString('base64');
  await page.goto('/');
  const outcomes = await page.evaluate(async encoded => {
    const image = new Image(); image.src = 'data:image/jpeg;base64,' + encoded; await image.decode();
    const outcomes = [];
    for (const pipeline of ['canvas', 'bitmap']) {
      const worker = new Worker('/vendor/hand-worker.js');
      const outcome = await new Promise<{ pipeline: string; hands: number; points: number; status: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Hand fixture inference timeout')), 30000);
        worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
        worker.onmessage = async event => {
          if (event.data.kind === 'ready') {
            const bitmap = await createImageBitmap(image);
            worker.postMessage({ kind: 'frame', frameId: 1, bitmap, timestamp: 100, pipeline, threshold: 0.65 }, [bitmap]);
          }
          if (event.data.kind === 'error') { clearTimeout(timer); reject(new Error(event.data.error)); }
          if (event.data.kind === 'result') {
            clearTimeout(timer); resolve({ pipeline, hands: event.data.stats.detectedHandCount, points: event.data.landmarks.length, status: event.data.status });
          }
        };
        worker.postMessage({ kind: 'init', base: location.origin });
      });
      worker.terminate(); outcomes.push(outcome);
    }
    return outcomes;
  }, fixture);
  console.log('Known-hand fixture comparison (not webcam validation):', outcomes);
  expect(outcomes[0]).toMatchObject({ pipeline: 'canvas', hands: 2, points: 21, status: 'hands' });
  // Also exercise the complete MediaStream -> video -> capture -> worker -> raw landmark overlay path.
  await page.addInitScript(encoded => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const image = new Image(); image.src = 'data:image/jpeg;base64,' + encoded; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!; const paint = () => ctx.drawImage(image, 0, 0);
      paint(); const stream = canvas.captureStream(30); const timer = setInterval(paint, 33);
      const track = stream.getVideoTracks()[0], stop = track.stop.bind(track);
      track.stop = () => { clearInterval(timer); stop(); }; return stream;
    } });
  }, fixture);
  await page.reload();
  await page.locator('#debug-toggle').check();
  await page.locator('#worker-preview-toggle').check();
  await page.locator('#mediapipe-landmarks-toggle').check();
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.locator('#pipeline-readout')).toContainText('detected hand count: 2', { timeout: 35000 });
  await expect(page.locator('#pipeline-readout')).toContainText('Points per hand: [21, 21]');
  await expect.poll(() => page.locator('#camera-landmarks').evaluate(c => {
    const canvas = c as HTMLCanvasElement;
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 === 3 && value > 0);
  })).toBe(true);
  await page.screenshot({ path: 'test-results/pipeline-debug.png', fullPage: true });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('debug panel shows actual portrait capture and throttled worker preview; disabling it stops previews and resets thresholds', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const c = document.createElement('canvas'); c.width = 360; c.height = 640;
      const ctx = c.getContext('2d')!;
      const paint = () => { ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 360, 320); ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 320, 360, 320); };
      paint(); const stream = c.captureStream(30); const timer = setInterval(paint, 33);
      const track = stream.getVideoTracks()[0], stop = track.stop.bind(track);
      track.stop = () => { clearInterval(timer); stop(); }; return stream;
    } });
  });
  await page.goto('/');
  await page.locator('#debug-toggle').check();
  await page.locator('#worker-preview-toggle').check();
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await expect(page.locator('#pipeline-readout')).toContainText('Model ready state: ready', { timeout: 35000 });
  await expect(page.locator('#worker-input-preview')).toHaveAttribute('data-input-size', '360x640');
  await expect(page.locator('#pipeline-readout')).toContainText('Frame processed successfully, zero hands');
  await expect(page.locator('#pipeline-readout')).toContainText('Actual worker input: 360 × 640');
  const pixels = await page.locator('#worker-input-preview').evaluate(c => {
    const canvas = c as HTMLCanvasElement; const ctx = canvas.getContext('2d')!;
    return [0.2, 0.8].map(y => [...ctx.getImageData(20, Math.round(canvas.height * y), 1, 1).data]);
  });
  expect(pixels).toEqual([[255, 0, 0, 255], [0, 0, 255, 255]]);
  await page.locator('#pipeline-threshold').selectOption('0.5');
  await expect(page.locator('#pipeline-readout')).toContainText('Detection / presence / tracking: 0.5 / 0.5 / 0.5');
  await page.locator('#debug-toggle').uncheck();
  await expect(page.locator('#pipeline-debug')).toBeHidden();
  await expect(page.locator('#worker-input-preview')).not.toHaveAttribute('data-frame-id');
  await page.waitForTimeout(800);
  await expect(page.locator('#worker-input-preview')).not.toHaveAttribute('data-frame-id');
  await page.locator('#debug-toggle').check();
  await expect(page.locator('#pipeline-threshold')).toHaveValue('0.65');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
});

test('writing-plane calibration preferences survive reload and can be reset', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('airboard-settings-seeded')) return;
    sessionStorage.setItem('airboard-settings-seeded', '1');
    localStorage.setItem('saai-airboard-hand-settings-v2', JSON.stringify({
      dominantHand: 'Left', gestureSensitivity: 'gentle', openPalmHoldMs: 220, palmEraserSize: 80, lassoCloseRadius: 60,
      inputMode: 'pen', stylusOffset: {x:.05,y:-.03}, fistGrabRadius: 75, twoHandHoldMs: 550, twoHandProximity: .2,
      planePoints: [{x:.1,y:.1},{x:.9,y:.15},{x:.8,y:.9},{x:.2,y:.8}],
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Calibration & settings', exact: true }).click();
  await expect(page.locator('[data-setting="dominantHand"]')).toHaveValue('Left');
  await expect(page.locator('[data-setting="inputMode"]')).toHaveValue('pen');
  await expect(page.locator('[data-stylus-status]')).toContainText('offset calibrated');
  await expect(page.locator('[data-plane-status]')).toContainText('Calibrated');
  await page.getByRole('button', { name: 'Reset plane', exact: true }).click();
  await expect(page.locator('[data-plane-status]')).toContainText('Not calibrated');
  await page.reload();
  await page.getByRole('button', { name: 'Calibration & settings', exact: true }).click();
  await expect(page.locator('[data-plane-status]')).toContainText('Not calibrated');
});
