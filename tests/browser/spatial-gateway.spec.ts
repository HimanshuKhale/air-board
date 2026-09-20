import { expect, test } from '@playwright/test';
import { build } from 'esbuild';

test('context controls rotate, undo, redo, and synchronize native geometry', async ({ page, context }) => {
  await page.goto('/'); await expect(page.locator('#drawing')).toBeVisible();
  const present = await context.newPage(); await present.goto('/present'); await expect(present.locator('#drawing')).toBeVisible();
  await page.getByRole('button', { name: 'Shapes', exact: true }).click();
  await page.getByRole('button', { name: 'rectangle', exact: true }).click();
  await expect(page.locator('#shape-edit-bar')).toBeVisible();
  await page.waitForTimeout(100);
  const initial = await page.locator('#drawing').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await page.locator('[data-action="object-rotate"]').click();
  await page.locator('[data-action="object-rotate-right"]').click();
  await expect.poll(() => page.locator('#drawing').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).not.toBe(initial);
  const studioRotated = await page.locator('#drawing').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await expect.poll(() => present.locator('#drawing').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(studioRotated);
  await present.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => page.locator('#drawing').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(initial);
  await present.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => page.locator('#drawing').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(studioRotated);
});

test('synthetic dominant-hand landmarks drive one atomic scale and three-chop subdivision', async ({ page }) => {
  const harness = await build({
    stdin: { contents: `
      import { InteractionController } from './src/interaction/controller';
      import { initialState } from './src/core/settings';
      import { reduce } from './src/sync/protocol';
      import { currentObjects } from './src/drawing/history';
      const neutral=()=>Array.from({length:21},()=>({x:.5,y:.5}));
      const transformHand=(extended=false)=>{
        const p=neutral();p[0]={x:.5,y:.82};p[1]={x:.48,y:.72};p[2]={x:.46,y:.64};p[3]={x:.48,y:.65};p[4]={x:.5,y:.69};
        [5,9,13,17].forEach((base,finger)=>{const x=.35+finger*.1;p[base]={x,y:.6};if(finger===0){p[base+1]={x,y:.52};p[base+2]={x:x+.04,y:.58};p[base+3]={x:x+.015,y:.69};}else{p[base+1]={x,y:.49};p[base+2]={x:x+.04,y:.39};p[base+3]=extended?{x:x+.14,y:.34}:{x:x+.10,y:.38};}});return p;
      };
      const chopHand=(dx=0)=>{
        const p=neutral();p[0]={x:.5+dx,y:.82};p[1]={x:.48+dx,y:.72};p[2]={x:.46+dx,y:.64};p[3]={x:.48+dx,y:.65};p[4]={x:.5+dx,y:.69};
        [5,9,13,17].forEach((base,finger)=>{const bx=.44+finger*.04+dx,tx=.49+finger*.01+dx;p[base]={x:bx,y:.6};p[base+1]={x:bx+(tx-bx)*.35,y:.46};p[base+2]={x:bx+(tx-bx)*.7,y:.3};p[base+3]={x:tx,y:.14};});return p;
      };
      const tracked=(points)=>({kind:'result',frameId:1,status:'hands',landmarks:points,allLandmarks:[points],duration:1,timestamp:1,stats:{framesReceived:1,inferenceCalls:1,successfulInferences:1,failedFrames:0,frameId:1,inputWidth:1000,inputHeight:1000,duration:1,landmarksArrayCount:1,detectedHandCount:1,landmarkCounts:[21],handedness:[[{categoryName:'Right',score:.99}]],lastSuccessAt:1,lastError:null,threshold:.65}});
      const makeController=(state,previews)=>new InteractionController({send(c){reduce(state,c);},routePinch(){},endPinch(){},map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){},previewObjects:p=>previews.push(p?.map(o=>o.id)??[])});
      window.runSpatialGateway=()=>{
        const scaleState=initialState(),previews=[];const rect={id:'rect',type:'rectangle',x:300,y:260,width:240,height:120,color:'#225c4a',strokeWidth:5,text:''};
        reduce(scaleState,{type:'create-object',object:rect});reduce(scaleState,{type:'select',ids:['rect']});scaleState.settings.objectGestureMode='scale';
        const scaleController=makeController(scaleState,previews);
        [[transformHand(),0],[transformHand(),220],[transformHand(true),280],[neutral(),320]].forEach(([points,at])=>scaleController.update(tracked(points),{width:1000,height:1000},at,scaleState.settings));
        const scaled=currentObjects(scaleState.history)[0];
        const cutState=initialState(),cutPreviews=[];const line={id:'line',type:'line',x:200,y:300,width:600,height:180,color:'#225c4a',strokeWidth:5,text:''};
        reduce(cutState,{type:'create-object',object:line});reduce(cutState,{type:'select',ids:['line']});cutState.settings.objectGestureMode='cut';
        const cutController=makeController(cutState,cutPreviews),frame=(points,at)=>cutController.update(tracked(points),{width:1000,height:1000},at,cutState.settings);
        frame(chopHand(0),0);frame(chopHand(.12),100);frame(neutral(),140);
        frame(chopHand(.12),200);frame(chopHand(0),300);frame(neutral(),340);
        frame(chopHand(0),400);frame(chopHand(.12),500);frame(neutral(),1900);
        return {scaledWidth:scaled.width,transformActions:scaleState.history.actions.filter(a=>a.kind==='transform').length,pieces:currentObjects(cutState.history).map(o=>o.id),subdivideActions:cutState.history.actions.filter(a=>a.kind==='subdivide').length,cutSelection:cutState.selection.length,previewed:cutPreviews.some(p=>p.length===3)};
      };
    `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser',
  });
  await page.addInitScript({ content: harness.outputFiles[0].text }); await page.goto('/present');
  const result = await page.evaluate(() => (window as unknown as { runSpatialGateway(): { scaledWidth: number; transformActions: number; pieces: string[]; subdivideActions: number; cutSelection: number; previewed: boolean } }).runSpatialGateway());
  expect(result.scaledWidth).toBeGreaterThan(240); expect(result.transformActions).toBe(1);
  expect(result.pieces).toHaveLength(3); expect(new Set(result.pieces).size).toBe(3);
  expect(result.subdivideActions).toBe(1); expect(result.cutSelection).toBe(3); expect(result.previewed).toBe(true);
});
