import { describe, expect, it } from 'vitest';
import { classifyFourFingertipPinch, classifyPenGrip, classifyPose, palmCenter } from '../../src/interaction/pose';
import { PoseStabilizer } from '../../src/interaction/temporal';
import { InteractionController } from '../../src/interaction/controller';
import { defaults, initialState } from '../../src/core/settings';
import { reduce, type Command } from '../../src/sync/protocol';
import type { Point } from '../../src/core/types';
import { currentStrokes } from '../../src/drawing/history';
import { TwoHandToggle } from '../../src/interaction/two-hand';
import { applyStylusOffset, calibrateStylusOffset, virtualNib } from '../../src/interaction/stylus';
import type { TrackingResult } from '../../src/tracking/protocol';

const size = { width: 1000, height: 1000 };
function pose(kind: 'open' | 'index' | 'fist' | 'ambiguous'): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6 }));
  p[0] = { x: 0.5, y: 0.82 }; p[4] = { x: 0.82, y: 0.55 };
  const bases = [5, 9, 13, 17];
  bases.forEach((base, finger) => {
    const x = 0.32 + finger * 0.12;
    p[base] = { x, y: 0.58 };
    const extended = kind === 'open' || (kind === 'index' && finger === 0) || (kind === 'ambiguous' && finger < 2);
    if (extended) {
      p[base + 1] = { x, y: 0.43 }; p[base + 2] = { x, y: 0.28 }; p[base + 3] = { x, y: 0.12 };
    } else {
      p[base + 1] = { x, y: 0.48 }; p[base + 2] = { x: x + 0.04, y: 0.55 }; p[base + 3] = { x: x + 0.02, y: 0.67 };
    }
  });
  return p;
}
function clustered(): Point[] {
  const p = pose('fist'), center = { x: .5, y: .34 };
  [4, 8, 12, 16, 20].forEach((index, i) => { p[index] = { x: center.x + (i - 2) * .006, y: center.y + Math.abs(i - 2) * .003 }; });
  return p;
}
function penGrip(): Point[] {
  const p = pose('fist'); p[4] = { ...p[8] }; p[12] = { x: p[8].x + .01, y: p[8].y + .01 }; return p;
}
const result = (points: Point[], name: 'Left' | 'Right' = 'Right'): TrackingResult => ({
  kind: 'result', frameId: 1, status: 'hands', landmarks: points, allLandmarks: [points], duration: 1, timestamp: 1,
  stats: { framesReceived: 1, inferenceCalls: 1, successfulInferences: 1, failedFrames: 0, frameId: 1, inputWidth: 1000, inputHeight: 1000,
    duration: 1, landmarksArrayCount: 1, detectedHandCount: 1, landmarkCounts: [21], handedness: [[{ categoryName: name, score: 0.99 }]], lastSuccessAt: 1, lastError: null, threshold: 0.65 },
});
const result2 = (right: Point[], left: Point[]): TrackingResult => {
  const value = result(right);
  value.allLandmarks = [right, left]; value.stats.detectedHandCount = 2; value.stats.landmarksArrayCount = 2; value.stats.landmarkCounts = [21, 21];
  value.stats.handedness = [[{categoryName:'Right',score:.99}],[{categoryName:'Left',score:.98}]];
  return value;
};

describe('geometric pose classification', () => {
  it.each([['open', 'open-palm'], ['index', 'index-only'], ['fist', 'fist'], ['ambiguous', 'neutral']] as const)('classifies %s without screen-up assumptions', (input, expected) => {
    expect(classifyPose(pose(input), size).gesture).toBe(expected);
  });
  it('computes a stable palm anchor', () => expect(palmCenter(pose('open'))).toEqual({ x: 0.5, y: 0.628 }));
  it('keeps pinch separate and authoritative', () => {
    const p = pose('open'); p[4] = { ...p[8] };
    expect(classifyPose(p, size).gesture).toBe('pinch');
  });
  it('distinguishes a five-tip lasso cluster from a three-point writing grip', () => {
    expect(classifyFourFingertipPinch(clustered(), size).active).toBe(true);
    expect(classifyPenGrip(clustered(), size).active).toBe(false);
    expect(classifyPenGrip(penGrip(), size).active).toBe(true);
    expect(classifyFourFingertipPinch(penGrip(), size).active).toBe(false);
  });
});

describe('temporal pose state', () => {
  it('requires stable entry and exits immediately to neutral', () => {
    const s = new PoseStabilizer(), hold = () => 200;
    expect(s.update('open-palm', 1, 0, hold).stable).toBe('neutral');
    expect(s.update('open-palm', 1, 199, hold).stable).toBe('neutral');
    expect(s.update('open-palm', 1, 200, hold).stable).toBe('open-palm');
    expect(s.update('neutral', 1, 201, hold).stable).toBe('neutral');
    s.reset(); expect(s.update('open-palm', 1, 500, hold).enterElapsedMs).toBe(0);
  });
});

describe('central interaction priority and open-palm erase', () => {
  it('never routes the physical left hand into board writing', () => {
    const state = initialState(), routed: string[] = [];
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch(_p, phase) { routed.push(phase); }, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    controller.update(result(pose('open'), 'Left'), size, 0, state.settings);
    controller.update(result(pose('open'), 'Left'), size, 300, state.settings);
    expect(routed).toEqual([]); expect(state.history.active).toBeNull();
  });
  it('ignores the opposite hand and commits one eraser stroke after the stable hold', () => {
    const state = initialState(), commands: Command[] = [], routed: string[] = [];
    const controller = new InteractionController({
      send(command) { commands.push(command); reduce(state, command); }, routePinch(_p, phase) { routed.push(phase); }, endPinch() {},
      map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {},
    });
    controller.update(result(pose('open'), 'Left'), size, 0, defaults());
    controller.update(result(pose('open')), size, 0, defaults());
    controller.update(result(pose('open')), size, 199, defaults());
    expect(commands).toHaveLength(0);
    controller.update(result(pose('open')), size, 200, defaults());
    controller.update(result(pose('open')), size, 220, defaults());
    controller.update(result(pose('ambiguous')), size, 240, defaults());
    expect(commands.map(command => command.type)).toEqual(['begin', 'point', 'end']);
    expect(state.history.actions).toHaveLength(1);
    expect(state.history.actions[0]).toMatchObject({ kind: 'stroke', stroke: { brush: { tool: 'eraser', size: 72 } } });
    expect(routed.every(phase => phase === 'hover')).toBe(true);
  });
  it('resets active erase on hand loss without a bridge', () => {
    const state = initialState();
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch() {}, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    controller.update(result(pose('open')), size, 0, defaults()); controller.update(result(pose('open')), size, 250, defaults());
    controller.reset();
    expect(state.history.active).toBeNull(); expect(state.history.actions).toHaveLength(1);
    controller.update(result(pose('open')), size, 500, defaults());
    expect(state.history.active).toBeNull();
  });
  it('cancels an unfinished lasso on tracking loss', () => {
    const state = initialState();
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch() {}, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    state.settings.lassoGesture = 'index-only';
    controller.update(result(pose('index')), size, 0, state.settings);
    controller.update(result(pose('index')), size, 250, state.settings);
    expect(controller.visuals.lasso.length).toBe(1);
    controller.reset();
    expect(controller.visuals.lasso).toEqual([]);
    expect(controller.diagnostics.lassoActive).toBe(false);
  });
  it('starts lasso only after a stable four-fingertip cluster', () => {
    const state = initialState(), routed: string[] = [];
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch(_p, phase) { routed.push(phase); }, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    controller.update(result(clustered()), size, 0, state.settings); expect(controller.visuals.lasso).toEqual([]);
    controller.update(result(clustered()), size, 230, state.settings);
    expect(controller.visuals.lasso).toHaveLength(1); expect(routed).toEqual([]);
    controller.update(result(pose('open')), size, 250, state.settings); expect(controller.visuals.lasso).toEqual([]);
  });
  it('keeps an active four-fingertip lasso through the wider release band', () => {
    const state = initialState();
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch() {}, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    controller.update(result(clustered()), size, 0, state.settings);
    controller.update(result(clustered()), size, 230, state.settings);
    const relaxed = clustered(); relaxed[20] = { x: .66, y: .34 };
    expect(classifyFourFingertipPinch(relaxed, size).active).toBe(false);
    controller.update(result(relaxed), size, 250, state.settings);
    expect(controller.diagnostics.lassoActive).toBe(true);
    controller.update(result(pose('open')), size, 270, state.settings);
    expect(controller.diagnostics.lassoActive).toBe(false);
  });
});

describe('fist grab and deterministic move history', () => {
  it('previews a nearby strand and commits one move that undo and redo reproduce', () => {
    const state = initialState(), commands: Command[] = [], previews: unknown[] = [];
    reduce(state, { type:'begin', id:'ink', brush:{tool:'pen',color:'#123456',size:6,opacity:.8}, point:{x:700,y:565} });
    reduce(state, { type:'point', id:'ink', point:{x:900,y:565} }); reduce(state, { type:'end', id:'ink' });
    const controller = new InteractionController({ send(c) { commands.push(c); reduce(state,c); }, routePinch() {}, endPinch() {}, previewMove: p => previews.push(p), map: p => ({x:p.x*1600,y:p.y*900}), showPointer() {}, getState:()=>state, toast() {} });
    controller.update(result(pose('fist')), size, 0, defaults());
    controller.update(result(pose('fist')), size, 200, defaults());
    expect(controller.diagnostics.interaction).toBe('drag');
    const moved = pose('fist').map(p => ({x:p.x+.1,y:p.y+.05}));
    controller.update(result(moved), size, 220, defaults());
    controller.update(result(pose('ambiguous')), size, 240, defaults());
    expect(commands.filter(c => c.type === 'move')).toHaveLength(1);
    expect(state.history.actions.at(-1)?.kind).toBe('move');
    expect(currentStrokes(state.history)[0]).toMatchObject({id:'ink',brush:{tool:'pen',color:'#123456',size:6,opacity:.8}});
    expect(currentStrokes(state.history)[0].points[0].x).toBeGreaterThan(700);
    reduce(state,{type:'undo'}); expect(currentStrokes(state.history)[0].points[0]).toEqual({x:700,y:565});
    reduce(state,{type:'redo'}); expect(currentStrokes(state.history)[0].points[0].x).toBeGreaterThan(700);
    expect(previews.at(-1)).toBeNull();
  });
  it('does not grab a distant strand and cancels a live preview on tracking loss', () => {
    const state = initialState(), commands: Command[] = [], previews: unknown[] = [];
    reduce(state,{type:'begin',id:'far',brush:{tool:'pen',color:'#000000',size:5,opacity:1},point:{x:20,y:20}}); reduce(state,{type:'end',id:'far'});
    const controller = new InteractionController({ send(c){commands.push(c);reduce(state,c);},routePinch(){},endPinch(){},previewMove:p=>previews.push(p),map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){} });
    controller.update(result(pose('fist')),size,0,defaults()); controller.update(result(pose('fist')),size,200,defaults());
    expect(commands.some(c=>c.type==='move')).toBe(false);
    reduce(state,{type:'select',ids:['far']});
    const near = pose('fist').map(p=>({x:p.x-.48,y:p.y-.64}));
    controller.update(result(pose('open')),size,250,defaults()); controller.update(result(near),size,300,defaults()); controller.update(result(near),size,500,defaults());
    controller.reset();
    expect(previews.at(-1)).toBeNull(); expect(commands.some(c=>c.type==='move')).toBe(false);
  });
});

describe('two-hand global control', () => {
  it('debounces, requires separation to rearm, and enforces cooldown', () => {
    const toggle = new TwoHandToggle(), a = pose('open'), b = a.map(p => ({x:p.x+.05,y:p.y}));
    expect(toggle.update([a,b],size,0,500,.22)).toBe(false);
    expect(toggle.update([a,b],size,499,500,.22)).toBe(false);
    expect(toggle.update([a,b],size,500,500,.22)).toBe(true);
    expect(toggle.update([a,b],size,1200,500,.22)).toBe(false);
    expect(toggle.update([a],size,1250,500,.22)).toBe(false);
    expect(toggle.update([a,b],size,1400,500,.22)).toBe(false);
    expect(toggle.update([a,b],size,1900,500,.22)).toBe(true);
  });
  it('pauses and resumes globally while clearing active hand state', () => {
    const state = initialState(), commands: Command[] = [];
    const controller = new InteractionController({send(c){commands.push(c);reduce(state,c);},routePinch(){},endPinch(){},map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){}});
    const a=pose('open'), b=a.map(p=>({x:p.x+.05,y:p.y}));
    controller.update(result(a),size,0,state.settings); controller.update(result(a),size,250,state.settings);
    expect(state.history.active).not.toBeNull();
    controller.update(result2(a,b),size,300,state.settings); controller.update(result2(a,b),size,800,state.settings);
    expect(state.settings.paused).toBe(false);
    controller.update(result(pose('ambiguous')),size,820,state.settings); expect(state.history.active).toBeNull();
    const neutral=pose('ambiguous'), neutral2=neutral.map(p=>({x:p.x+.05,y:p.y}));
    controller.update(result2(neutral,neutral2),size,900,state.settings); controller.update(result2(neutral,neutral2),size,1400,state.settings);
    expect(state.settings.paused).toBe(true);
    const actionCount=state.history.actions.length;
    controller.update(result2(neutral,neutral2),size,1500,state.settings); expect(state.history.actions).toHaveLength(actionCount);
    controller.update(result(neutral),size,1600,state.settings);
    controller.update(result2(neutral,neutral2),size,2200,state.settings); controller.update(result2(neutral,neutral2),size,2800,state.settings);
    expect(state.settings.paused).toBe(false);
    expect(commands.filter(c=>c.type==='settings' && 'paused' in c.patch)).toHaveLength(2);
  });
  it('does not toggle pause while a left-hand confirmation request owns the two-hand pose', () => {
    const state = initialState(), commands: Command[] = [], confirmations: string[] = [];
    const controller = new InteractionController({ send(c) { commands.push(c); reduce(state, c); }, routePinch() {}, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {}, confirmationPending: () => true, confirmationPose: pose => confirmations.push(pose) });
    const right = pose('open'), left = right.map(point => ({ x: point.x + .05, y: point.y }));
    controller.update(result2(right, left), size, 0, state.settings);
    controller.update(result2(right, left), size, 700, state.settings);
    expect(commands.some(command => command.type === 'settings' && 'paused' in command.patch)).toBe(false);
    expect(controller.diagnostics.twoHandClose).toBe(false); expect(confirmations.length).toBeGreaterThan(0);
  });
});

describe('Stylus Assist geometry', () => {
  it('extends the pinch center away from the palm and applies a calibrated board offset', () => {
    const points=pose('open'); points[4]={x:.4,y:.25}; points[8]={x:.42,y:.23};
    const nib=virtualNib(points,size)!; const pinch={x:.41,y:.24}, palm=palmCenter(points);
    expect(Math.hypot(nib.x-palm.x,nib.y-palm.y)).toBeGreaterThan(Math.hypot(pinch.x-palm.x,pinch.y-palm.y));
    const offset=calibrateStylusOffset({x:720,y:405}); expect(offset).toEqual({x:.05,y:.05});
    expect(applyStylusOffset({x:720,y:405},offset)).toEqual({x:800,y:450});
  });
  it('switches the controller pointer from index tip to virtual nib and resets it on loss', () => {
    const state=initialState(), points=pose('open'); points[4]={x:.4,y:.25}; points[8]={x:.42,y:.23}; state.settings.inputMode='pen';
    const controller=new InteractionController({send:c=>reduce(state,c),routePinch(){},endPinch(){},map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){}});
    controller.update(result(points),size,0,state.settings);
    expect(controller.pointer?.raw).toEqual(virtualNib(points,size)); expect(controller.diagnostics.virtualNibPoint).not.toBeNull();
    controller.reset(); expect(controller.diagnostics.virtualNibPoint).toBeNull();
    state.settings.inputMode='finger'; controller.update(result(points),size,100,state.settings); expect(controller.pointer?.raw).toEqual(points[8]);
  });
  it('captures a center-target offset after an armed stylus pinch', () => {
    const state=initialState(), commands: Command[] = [], points=pose('open'); points[4]={x:.75,y:.25};
    const controller=new InteractionController({send(c){commands.push(c);reduce(state,c);},routePinch(){},endPinch(){},map:p=>({x:p.x*1600,y:p.y*900}),showPointer(){},getState:()=>state,toast(){}});
    controller.startStylusCalibration(); expect(state.settings.inputMode).toBe('pen'); expect(controller.visuals.stylusTarget).toBe(true);
    controller.update(result(points),size,0,state.settings);
    const gripped=pose('fist'); gripped[4]={...gripped[8]}; gripped[12]={x:gripped[8].x+.01,y:gripped[8].y+.01};
    controller.update(result(gripped),size,100,state.settings); controller.update(result(gripped),size,300,state.settings);
    expect(commands.some(c=>c.type==='settings' && 'stylusOffset' in c.patch)).toBe(true);
    expect(controller.visuals.stylusTarget).toBe(false);
  });
  it('uses the pen grip clutch for one stroke and ignores ordinary pinch in Pen Writing mode', () => {
    const state = initialState(), phases: string[] = []; state.settings.inputMode = 'pen';
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch(_p, phase) { phases.push(phase); }, endPinch() {}, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    controller.update(result(pose('fist')), size, 0, state.settings);
    const ordinary = pose('open'); ordinary[4] = { ...ordinary[8] };
    controller.update(result(ordinary), size, 50, state.settings); controller.update(result(ordinary), size, 250, state.settings);
    expect(phases.filter(phase => phase.startsWith('pinch'))).toEqual([]);
    controller.update(result(pose('fist')), size, 260, state.settings);
    controller.update(result(penGrip()), size, 300, state.settings); controller.update(result(penGrip()), size, 500, state.settings);
    const moved = penGrip().map(point => ({ x: point.x + .02, y: point.y + .01 })); controller.update(result(moved), size, 530, state.settings);
    controller.update(result(pose('fist')), size, 550, state.settings);
    expect(phases).toEqual(['pinchStart', 'pinchHold', 'pinchEnd']);
  });
  it('requires a fresh release after tracking interruption and mode changes', () => {
    const state = initialState(), phases: string[] = []; let ended = 0; state.settings.inputMode = 'pen';
    const controller = new InteractionController({ send: c => reduce(state, c), routePinch(_p, phase) { phases.push(phase); }, endPinch() { ended++; }, map: p => ({ x: p.x * 1600, y: p.y * 900 }), showPointer() {}, getState: () => state, toast() {} });
    controller.update(result(pose('fist')), size, 0, state.settings);
    controller.update(result(penGrip()), size, 20, state.settings); controller.update(result(penGrip()), size, 220, state.settings);
    expect(phases).toEqual(['pinchStart']);
    controller.reset(); expect(ended).toBeGreaterThan(0);
    controller.update(result(penGrip()), size, 300, state.settings); controller.update(result(penGrip()), size, 600, state.settings);
    expect(phases).toEqual(['pinchStart']);
    controller.update(result(pose('fist')), size, 620, state.settings);
    controller.update(result(penGrip()), size, 640, state.settings); controller.update(result(penGrip()), size, 840, state.settings);
    expect(phases).toEqual(['pinchStart', 'pinchStart']);
    state.settings.inputMode = 'finger'; controller.update(result(pose('ambiguous')), size, 860, state.settings);
    state.settings.inputMode = 'pen'; controller.update(result(penGrip()), size, 900, state.settings); controller.update(result(penGrip()), size, 1200, state.settings);
    expect(phases).toEqual(['pinchStart', 'pinchStart']);
  });
});
