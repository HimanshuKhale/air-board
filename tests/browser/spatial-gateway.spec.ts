import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

test('manual positional cut creates two synchronized objects, clears selection, and remains exportable', async ({ page, context }) => {
  await page.goto('/'); await expect(page.locator('#drawing')).toBeVisible();
  const present = await context.newPage(); await present.goto('/present'); await expect(present.locator('#drawing')).toBeVisible();
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'rectangle', exact: true }).click();
  await expect(page.locator('#shape-edit-bar')).toBeVisible(); await expect(page.locator('#selection-count')).toHaveText('1');
  await page.locator('[data-action="object-full"]').click(); await expect(page.locator('[data-action="object-full"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="object-cut"]').click();
  const before = await page.locator('#drawing').evaluate(element => (element as HTMLCanvasElement).toDataURL());
  const canvas = page.locator('#drawing'), box = await canvas.boundingBox(); expect(box).toBeTruthy();
  const center = { x: box!.x + 200 / 1600 * box!.width, y: box!.y + 160 / 900 * box!.height };
  await page.mouse.move(center.x, center.y); await page.mouse.down(); await page.mouse.move(center.x, center.y + 80); await page.mouse.up();
  await expect(page.locator('#spatial-live-status')).toContainText('VALID CUT');
  await page.locator('[data-action="object-apply-cut"]').click(); await expect(page.locator('#shape-edit-bar')).toBeHidden();
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())).not.toBe(before);
  const cutImage = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await expect.poll(() => present.locator('#drawing').evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(cutImage);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Drawing only', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('.png');
  await present.getByRole('button', { name: 'Undo', exact: true }).click();
  await present.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => present.locator('#drawing').evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(cutImage);
});

test('synthetic dominant-hand fist drives one atomic full manipulation and tracking loss cancels a preview', async ({ page }) => {
  const harness = await build({
    stdin: { contents: `
      import { InteractionController } from './src/interaction/controller'; import { initialState } from './src/core/settings'; import { reduce } from './src/sync/protocol'; import { currentObjects } from './src/drawing/history';
      const fist=()=>{const p=Array.from({length:21},()=>({x:.5,y:.65}));p[0]={x:.5,y:.82};[5,9,13,17].forEach((base,finger)=>{const x=.38+finger*.08;p[base]={x,y:.58};p[base+1]={x,y:.5};p[base+2]={x:x+.025,y:.56};p[base+3]={x:x+.035,y:.63};});p[1]={x:.45,y:.7};p[2]={x:.43,y:.66};p[3]={x:.46,y:.64};p[4]={x:.5,y:.66};return p;};
      const transform=(points,dx,scale,angle)=>{const c={x:.5,y:.65},cs=Math.cos(angle),sn=Math.sin(angle);return points.map(p=>{const x=(p.x-c.x)*scale,y=(p.y-c.y)*scale;return{x:c.x+x*cs-y*sn+dx,y:c.y+x*sn+y*cs};});};
      const open=()=>Array.from({length:21},(_,i)=>({x:.35+(i%5)*.06,y:.8-Math.floor(i/5)*.12}));
      const tracked=points=>({kind:'result',frameId:1,status:'hands',landmarks:points,allLandmarks:[points],duration:1,timestamp:1,stats:{framesReceived:1,inferenceCalls:1,successfulInferences:1,failedFrames:0,frameId:1,inputWidth:1000,inputHeight:1000,duration:1,landmarksArrayCount:1,detectedHandCount:1,landmarkCounts:[21],handedness:[[{categoryName:'Right',score:.99}]],lastSuccessAt:1,lastError:null,threshold:.65}});
      const make=(state,previews)=>new InteractionController({send(c){reduce(state,c);},routePinch(){},endPinch(){},map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){},previewObjects:p=>previews.push(p?.map(o=>({x:o.x,y:o.y,width:o.width,rotation:o.rotation}))??[])});
      window.runFistGateway=()=>{const state=initialState(),previews=[];const rect={id:'rect',type:'rectangle',x:650,y:500,width:300,height:150,color:'#225c4a',strokeWidth:5,text:''};reduce(state,{type:'create-object',object:rect});reduce(state,{type:'select',ids:['rect']});state.settings.objectGestureMode='full';state.settings.spatialSmoothing=.8;
        const controller=make(state,previews),base=fist(),changed=transform(base,.05,1.12,.1),frame=(points,at)=>controller.update(tracked(points),{width:1000,height:1000},at,state.settings);frame(base,0);frame(base,220);frame(changed,270);frame(open(),310);frame(open(),420);
        const result=currentObjects(state.history)[0],actions=state.history.actions.filter(a=>a.kind==='transform').length;const cancelState=initialState(),cancelPreviews=[];reduce(cancelState,{type:'create-object',object:rect});reduce(cancelState,{type:'select',ids:['rect']});cancelState.settings.objectGestureMode='full';const cancel=make(cancelState,cancelPreviews);cancel.update(tracked(base),{width:1000,height:1000},0,cancelState.settings);cancel.update(tracked(base),{width:1000,height:1000},220,cancelState.settings);cancel.reset();return {result,actions,previewed:previews.some(p=>p.length===1&&p[0].width>300),cancelActions:cancelState.history.actions.filter(a=>a.kind==='transform').length,selection:state.selection};};
    `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser',
  });
  await page.addInitScript({ content: harness.outputFiles[0].text }); await page.goto('/present');
  const result = await page.evaluate(() => (window as unknown as { runFistGateway(): { result: { x: number; width: number; rotation: number }; actions: number; previewed: boolean; cancelActions: number; selection: string[] } }).runFistGateway());
  expect(result.result.x).toBeGreaterThan(650); expect(result.result.width).toBeGreaterThan(300); expect(Math.abs(result.result.rotation)).toBeGreaterThan(.05);
  expect(result.actions).toBe(1); expect(result.previewed).toBe(true); expect(result.cancelActions).toBe(0); expect(result.selection).toEqual(['rect']);
});
