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

test('synthetic anatomical right-hand landmarks resize a native shape through the real controller', async ({ page }) => {
  const harness = await build({
    stdin: { contents: `
      import { InteractionController } from './src/interaction/controller';
      import { initialState } from './src/core/settings';
      import { reduce } from './src/sync/protocol';
      import { makeShape } from './src/drawing/geometry';
      import { currentObjects } from './src/drawing/history';
      const poseAt = (x, y, pinched = false) => {
        const p = Array.from({length:21},()=>({x:.5,y:.6})); p[0]={x:.5,y:.82}; p[4]={x:.82,y:.55};
        [5,9,13,17].forEach((base,finger)=>{const fx=.32+finger*.12;p[base]={x:fx,y:.58};p[base+1]={x:fx,y:.43};p[base+2]={x:fx,y:.28};p[base+3]={x:fx,y:.12};});
        const dx=x-p[8].x,dy=y-p[8].y; for(const q of p){q.x+=dx;q.y+=dy;} if(pinched)p[4]={...p[8]}; return p;
      };
      const tracked = (points, timestamp) => ({kind:'result',frameId:1,status:'hands',landmarks:points,allLandmarks:[points],duration:1,timestamp,stats:{framesReceived:1,inferenceCalls:1,successfulInferences:1,failedFrames:0,frameId:1,inputWidth:1000,inputHeight:1000,duration:1,landmarksArrayCount:1,detectedHandCount:1,landmarkCounts:[21],handedness:[[{categoryName:'Left',score:.99}]],lastSuccessAt:1,lastError:null,threshold:.65}});
      window.runNativeHandTransform = () => {
        const state=initialState(),commands=[],previews=[]; const object=makeShape('rectangle','shape',90,90,220,140,'#225c4a',5);
        reduce(state,{type:'create-object',object}); reduce(state,{type:'select',ids:[object.id]});
        const controller=new InteractionController({send(c){commands.push(c);reduce(state,c);},routePinch(){},endPinch(){},previewObject:o=>previews.push(o),map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){}});
        const start={x:310/1600,y:230/900},end={x:430/1600,y:320/900};
        controller.update(tracked(poseAt(start.x,start.y),0),{width:1000,height:1000},0,state.settings);
        controller.update(tracked(poseAt(start.x,start.y,true),100),{width:1000,height:1000},100,state.settings);
        controller.update(tracked(poseAt(start.x,start.y,true),170),{width:1000,height:1000},170,state.settings);
        controller.update(tracked(poseAt(end.x,end.y,true),240),{width:1000,height:1000},240,state.settings);
        controller.update(tracked(poseAt(end.x,end.y),300),{width:1000,height:1000},300,state.settings);
        const final=currentObjects(state.history)[0]; return {updates:commands.filter(c=>c.type==='update-object').length,width:final.width,height:final.height,previewCleared:previews.at(-1)===null,actions:state.history.actions.length};
      };
    `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser',
  });
  await page.addInitScript({ content: harness.outputFiles[0].text }); await page.goto('/present');
  const result = await page.evaluate(() => (window as unknown as { runNativeHandTransform(): { updates: number; width: number; height: number; previewCleared: boolean; actions: number } }).runNativeHandTransform());
  expect(result.updates).toBe(1); expect(result.width).toBeGreaterThan(220); expect(result.height).toBeGreaterThan(140);
  expect(result.previewCleared).toBe(true); expect(result.actions).toBe(2);
});
