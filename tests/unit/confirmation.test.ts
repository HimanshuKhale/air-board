import { describe, expect, it } from 'vitest';
import { ConfirmationMachine, SHAPE_CONFIRMATION_MS } from '../../src/interaction/confirmation';
import { anatomicalHandedness, classifyConfirmationPose } from '../../src/interaction/pose';
import type { Point } from '../../src/core/types';

const size = { width: 1000, height: 1000 };
function confirmationPose(kind: 'yes' | 'no'): Point[] {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .62 }));
  p[0] = { x: .5, y: .82 };
  const bases = [5, 9, 13, 17];
  bases.forEach((base, finger) => {
    const x = .38 + finger * .09, extended = kind === 'yes' ? finger < 2 : finger === 3;
    p[base] = { x, y: .6 };
    if (extended) { p[base + 1] = { x, y: .46 }; p[base + 2] = { x, y: .3 }; p[base + 3] = { x: x + (finger === 0 ? -.035 : finger === 1 ? .035 : 0), y: .12 }; }
    else { p[base + 1] = { x, y: .52 }; p[base + 2] = { x: x + .04, y: .58 }; p[base + 3] = { x: x + .015, y: .69 }; }
  });
  if (kind === 'no') { p[1] = { x: .46, y: .72 }; p[2] = { x: .38, y: .67 }; p[3] = { x: .29, y: .62 }; p[4] = { x: .18, y: .56 }; }
  else { p[1] = { x: .48, y: .7 }; p[2] = { x: .46, y: .64 }; p[3] = { x: .48, y: .65 }; p[4] = { x: .5, y: .69 }; }
  return p;
}

describe('left-hand gesture approval', () => {
  it('maps raw MediaPipe labels to anatomical hands once', () => {
    expect(anatomicalHandedness([{ categoryName: 'Right', score: .9 }])).toBe('Left');
    expect(anatomicalHandedness([{ categoryName: 'Left', score: .9 }])).toBe('Right');
    expect(anatomicalHandedness([{ categoryName: 'Right', score: .9 }], true)).toBe('Right');
    expect(anatomicalHandedness([{ categoryName: 'Right', score: .6 }], false, .7)).toBeNull();
  });
  it('classifies V as yes and shaka as no independent of screen-up', () => {
    expect(classifyConfirmationPose(confirmationPose('yes'), size).gesture).toBe('CONFIRM_YES');
    expect(classifyConfirmationPose(confirmationPose('no'), size).gesture).toBe('CONFIRM_NO');
    const rotated = confirmationPose('yes').map(({ x, y }) => ({ x: .5 - (y - .5), y: .5 + (x - .5) }));
    expect(classifyConfirmationPose(rotated, size).gesture).toBe('CONFIRM_YES');
    expect(classifyConfirmationPose(Array.from({ length: 21 }, () => ({ x: .5, y: .5 })), size).gesture).toBe('neutral');
  });
  it('uses the previous three seconds plus exactly five seconds', () => expect(SHAPE_CONFIRMATION_MS).toBe(8000));
  it('requires a stable hold, settles once, and requires release before another request', () => {
    const machine = new ConfirmationMachine(400);
    machine.begin('a', 'shape', 100);
    expect(machine.observe('CONFIRM_YES', .9, 200)).toBeNull();
    expect(machine.observe('CONFIRM_YES', .9, 599)).toBeNull();
    expect(machine.observe('CONFIRM_YES', .9, 600)).toEqual({ id: 'a', decision: 'yes' });
    expect(machine.settle('a', 'no')).toBeNull();
    machine.begin('b', 'shape', 700);
    expect(machine.observe('CONFIRM_NO', .9, 1200)).toBeNull();
    machine.observe('neutral', 0, 1201);
    expect(machine.observe('CONFIRM_NO', .9, 1202)).toBeNull();
    expect(machine.observe('CONFIRM_NO', .9, 1602)).toEqual({ id: 'b', decision: 'no' });
  });
  it('binds timeout to the active request and rejects stale decisions', () => {
    const machine = new ConfirmationMachine(300);
    machine.begin('first', 'one', 0); machine.cancel(); machine.observe('neutral', 0, 1);
    machine.begin('second', 'two', 10);
    expect(machine.settle('first', 'yes')).toBeNull();
    expect(machine.tick(8009)).toBeNull();
    expect(machine.tick(8010)).toEqual({ id: 'second', decision: 'timeout' });
    expect(machine.observe('CONFIRM_YES', 1, 9000)).toBeNull();
  });
  it('does not count time across a tracking interruption', () => {
    const machine = new ConfirmationMachine(300); machine.begin('a', 'shape', 0);
    machine.observe('CONFIRM_YES', .9, 10); machine.interrupt();
    expect(machine.observe('CONFIRM_YES', .9, 1000)).toBeNull();
    machine.observe('neutral', 0, 1001); machine.observe('CONFIRM_YES', .9, 1002);
    expect(machine.observe('CONFIRM_YES', .9, 1302)).toEqual({ id: 'a', decision: 'yes' });
  });
});
