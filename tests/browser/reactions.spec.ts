import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

test('reaction previews synchronize, reject replay, expire, and stay out of PNG export', async ({ page, context }) => {
  await page.goto('/'); await expect(page.locator('#drawing')).toBeVisible();
  const present = await context.newPage(); await present.goto('/present'); await expect(present.locator('#drawing')).toBeVisible();

  await page.getByRole('button', { name: 'Calibration & settings', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Thumbs-up', exact: true }).click();
  await expect(page.locator('.reaction-effect')).toHaveCount(1);
  await expect(present.locator('.reaction-effect')).toHaveCount(1);
  await expect(page.locator('.reaction-effect')).toHaveAttribute('data-reaction-type', 'thumbs-up');
  await expect(page.locator('.reaction-effect span')).toHaveText('👍');
  const studioPosition = await page.locator('.reaction-effect').evaluate(element => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }));
  const presentationPosition = await present.locator('.reaction-effect').evaluate(element => ({ left: (element as HTMLElement).style.left, top: (element as HTMLElement).style.top }));
  expect(presentationPosition).toEqual(studioPosition);

  const id = await page.locator('.reaction-effect').getAttribute('data-reaction-id');
  await page.evaluate(reactionId => {
    const channel = new BroadcastChannel('saai-airboard-v1');
    const current = Date.now();
    channel.postMessage({ v: 1, kind: 'reaction', sender: 'browser-test', event: { id: reactionId, type: 'thumbs-up', emoji: '👍', position: { x: .5, y: .5 }, createdAt: current, duration: 2500, intensity: 'normal' } });
    channel.postMessage({ v: 1, kind: 'reaction', sender: 'browser-test', event: { id: 'expired-reaction', type: 'thumbs-up', emoji: '👍', position: { x: .5, y: .5 }, createdAt: current - 3000, duration: 2500, intensity: 'normal' } });
    channel.close();
  }, id);
  await page.waitForTimeout(100);
  await expect(page.locator('.reaction-effect')).toHaveCount(1);
  await expect(present.locator('.reaction-effect')).toHaveCount(1);

  await page.getByRole('button', { name: 'Close settings' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Drawing only', exact: true }).click();
  const download = await pending, chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  const pixel = await page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    return [...context.getImageData(448, 405, 1, 1).data];
  }, Buffer.concat(chunks).toString('base64'));
  expect(pixel).toEqual([0, 0, 0, 0]);

  await expect(page.locator('.reaction-effect')).toHaveCount(0, { timeout: 4000 });
  await expect(present.locator('.reaction-effect')).toHaveCount(0, { timeout: 4000 });
});

test('real interaction controller accepts left reactions while right writing continues', async ({ page }) => {
  const harness = await build({
    stdin: { contents: `
      import { InteractionController } from './src/interaction/controller';
      import { initialState } from './src/core/settings';
      import { reduce } from './src/sync/protocol';
      const folded = () => {
        const p=Array.from({length:21},()=>({x:.5,y:.62})); p[0]={x:.5,y:.82};
        [5,9,13,17].forEach((base,finger)=>{const x=.36+finger*.09;p[base]={x,y:.6};p[base+1]={x,y:.52};p[base+2]={x:x+.04,y:.58};p[base+3]={x:x+.015,y:.69};});
        p[1]={x:.46,y:.72};p[2]={x:.38,y:.64};p[3]={x:.29,y:.54};p[4]={x:.18,y:.43};return p;
      };
      const open = () => { const p=folded(); [5,9,13,17].forEach((base,finger)=>{const x=.32+finger*.12;p[base]={x,y:.58};p[base+1]={x,y:.43};p[base+2]={x,y:.28};p[base+3]={x,y:.12};});return p; };
      const shift=(p,dx)=>p.map(q=>({x:q.x+dx,y:q.y}));
      const tracked=(right,left)=>({kind:'result',frameId:1,status:'hands',landmarks:right,allLandmarks:[right,left],duration:1,timestamp:1,stats:{framesReceived:1,inferenceCalls:1,successfulInferences:1,failedFrames:0,frameId:1,inputWidth:1000,inputHeight:1000,duration:1,landmarksArrayCount:2,detectedHandCount:2,landmarkCounts:[21,21],handedness:[[{categoryName:'Right',score:.99}],[{categoryName:'Left',score:.99}]],lastSuccessAt:1,lastError:null,threshold:.65}});
      const run=(reactionsEnabled)=>{
        const state=initialState(),phases=[],events=[];
        state.settings.reactionsEnabled=reactionsEnabled;
        const controller=new InteractionController({send(c){reduce(state,c);},routePinch(_p,phase){phases.push(phase);},endPinch(){},map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){},reaction:e=>events.push(e.type)});
        const rightOpen=shift(open(),.22),rightPinch=shift(open(),.22),left=shift(folded(),-.28);rightPinch[4]={...rightPinch[8]};
        [[rightOpen,0],[rightPinch,100],[rightPinch,180],[rightPinch,270],[shift(rightPinch,.01),320]].forEach(([right,at])=>controller.update(tracked(right,left),{width:1000,height:1000},at,state.settings));
        return {events,phases,reactionState:controller.diagnostics.reactionState};
      };
      window.runReactionHarness=()=>({enabled:run(true),disabled:run(false)});
    `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser',
  });
  await page.addInitScript({ content: harness.outputFiles[0].text }); await page.goto('/present');
  const result = await page.evaluate(() => (window as unknown as { runReactionHarness(): { enabled: { events: string[]; phases: string[]; reactionState: string }; disabled: { events: string[]; phases: string[] } } }).runReactionHarness());
  expect(result.enabled.events).toEqual(['thumbs-up']);
  expect(result.enabled.phases).toContain('pinchStart'); expect(result.enabled.phases).toContain('pinchHold');
  expect(['STABLE', 'FIRED']).toContain(result.enabled.reactionState);
  expect(result.disabled.events).toEqual([]);
  expect(result.disabled.phases).toContain('pinchStart'); expect(result.disabled.phases).toContain('pinchHold');
});

test('reaction settings persist locally and restore conservative defaults', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#drawing')).toBeVisible();
  await page.getByRole('button', { name: 'Calibration & settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Enable reactions' }).uncheck();
  await page.getByRole('combobox', { name: 'Thumbs-up reaction' }).selectOption('👏');
  await page.getByRole('combobox', { name: 'Effect intensity' }).selectOption('subtle');
  await page.getByRole('slider', { name: 'Reaction animation duration' }).fill('1500');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('saai-airboard-hand-settings-v2') ?? '{}'))).toMatchObject({
    reactionsEnabled: false, reactionIntensity: 'subtle', reactionDurationMs: 1500,
  });
  await page.reload(); await page.getByRole('button', { name: 'Calibration & settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Enable reactions' })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Thumbs-up reaction' })).toHaveValue('👏');
  await expect(page.getByRole('combobox', { name: 'Effect intensity' })).toHaveValue('subtle');
  await expect(page.getByRole('slider', { name: 'Reaction animation duration' })).toHaveValue('1500');
  await page.getByRole('button', { name: 'Restore reaction defaults' }).click();
  await expect(page.getByRole('checkbox', { name: 'Thumbs-up' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Finger heart' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'V sign' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Shaka' })).not.toBeChecked();
});
