import { describe, expect, it } from 'vitest';
import { defaults, initialState } from '../../src/core/settings';
import type { Point } from '../../src/core/types';
import { InteractionController } from '../../src/interaction/controller';
import { ReactionController } from '../../src/reactions/controller';
import { validReactionEvent } from '../../src/reactions/event';
import { classifyReactionPose, type ReactionPose } from '../../src/reactions/pose';
import { reduce } from '../../src/sync/protocol';
import type { TrackingResult } from '../../src/tracking/protocol';

const size = { width: 1000, height: 1000 };
const neutral: ReactionPose = { gesture: 'neutral', confidence: 0, anchor: { x: .5, y: .5 } };
const thumbs: ReactionPose = { gesture: 'thumbs-up', confidence: .9, anchor: { x: .25, y: .3 } };

function foldedHand(): Point[] {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .62 }));
  points[0] = { x: .5, y: .82 };
  [5, 9, 13, 17].forEach((base, finger) => {
    const x = .36 + finger * .09;
    points[base] = { x, y: .6 };
    points[base + 1] = { x, y: .52 };
    points[base + 2] = { x: x + .04, y: .58 };
    points[base + 3] = { x: x + .015, y: .69 };
  });
  points[1] = { x: .46, y: .72 }; points[2] = { x: .38, y: .64 };
  points[3] = { x: .29, y: .54 }; points[4] = { x: .18, y: .43 };
  return points;
}

function fingerHeart(): Point[] {
  const points = foldedHand();
  points[1] = { x: .48, y: .72 }; points[2] = { x: .43, y: .63 };
  points[3] = { x: .36, y: .56 }; points[4] = { x: .39, y: .49 };
  points[5] = { x: .36, y: .6 }; points[6] = { x: .36, y: .52 };
  points[7] = { x: .42, y: .51 }; points[8] = { x: .40, y: .49 };
  return points;
}

function openHand(): Point[] {
  const points = foldedHand();
  [5, 9, 13, 17].forEach((base, finger) => {
    const x = .32 + finger * .12;
    points[base] = { x, y: .58 }; points[base + 1] = { x, y: .43 };
    points[base + 2] = { x, y: .28 }; points[base + 3] = { x, y: .12 };
  });
  return points;
}

function vSign(): Point[] {
  const points = foldedHand();
  [5, 9].forEach((base, finger) => {
    const x = .38 + finger * .09;
    points[base] = { x, y: .6 }; points[base + 1] = { x, y: .46 };
    points[base + 2] = { x, y: .3 }; points[base + 3] = { x: x + (finger ? .035 : -.035), y: .12 };
  });
  points[1] = { x: .48, y: .7 }; points[2] = { x: .46, y: .64 };
  points[3] = { x: .48, y: .65 }; points[4] = { x: .5, y: .69 };
  return points;
}

function shifted(points: Point[], dx: number): Point[] { return points.map(point => ({ x: point.x + dx, y: point.y })); }
function tracked(right: Point[], left: Point[]): TrackingResult {
  return {
    kind: 'result', frameId: 1, status: 'hands', landmarks: right, allLandmarks: [right, left], duration: 1, timestamp: 1,
    stats: { framesReceived: 1, inferenceCalls: 1, successfulInferences: 1, failedFrames: 0, frameId: 1, inputWidth: 1000, inputHeight: 1000,
      duration: 1, landmarksArrayCount: 2, detectedHandCount: 2, landmarkCounts: [21, 21],
      handedness: [[{ categoryName: 'Right', score: .99 }], [{ categoryName: 'Left', score: .99 }]], lastSuccessAt: 1, lastError: null, threshold: .65 },
  };
}

describe('reaction landmark recognition', () => {
  it('recognizes conservative thumbs-up and finger-heart fixtures', () => {
    expect(classifyReactionPose(foldedHand(), size)).toMatchObject({ gesture: 'thumbs-up' });
    expect(classifyReactionPose(fingerHeart(), size)).toMatchObject({ gesture: 'finger-heart' });
  });
  it('does not treat an ordinary open-hand pinch as a finger heart', () => {
    const points = openHand(); points[4] = { ...points[8] };
    expect(classifyReactionPose(points, size).gesture).not.toBe('finger-heart');
  });
  it('exposes V as an optional reaction mapping outside confirmation ownership', () => {
    expect(classifyReactionPose(vSign(), size).gesture).toBe('v-sign');
  });
});

describe('reaction temporal controller', () => {
  it('holds before firing once and requires release to rearm', () => {
    const controller = new ReactionController(260, 1200), settings = defaults();
    expect(controller.update(thumbs, thumbs.anchor, 0, settings, 10_000)).toBeNull();
    expect(controller.state).toBe('CANDIDATE');
    expect(controller.update(thumbs, thumbs.anchor, 259, settings, 10_259)).toBeNull();
    const event = controller.update(thumbs, thumbs.anchor, 260, settings, 10_260);
    expect(event).toMatchObject({ type: 'thumbs-up', emoji: '👍', duration: 2500, intensity: 'normal' });
    expect(controller.state).toBe('STABLE');
    expect(controller.update(thumbs, thumbs.anchor, 300, settings)).toBeNull();
    expect(controller.update(thumbs, thumbs.anchor, 340, settings)).toBeNull();
    expect(controller.state).toBe('WAITING_FOR_RELEASE');
    controller.update(neutral, neutral.anchor, 350, settings);
    expect(controller.state).toBe('IDLE');
  });
  it('enforces cooldown and restarts its hold after tracking loss', () => {
    const controller = new ReactionController(260, 1200), settings = defaults();
    controller.update(thumbs, thumbs.anchor, 0, settings); controller.update(thumbs, thumbs.anchor, 260, settings);
    controller.update(thumbs, thumbs.anchor, 300, settings); controller.update(thumbs, thumbs.anchor, 340, settings);
    controller.update(neutral, neutral.anchor, 350, settings);
    expect(controller.update(thumbs, thumbs.anchor, 400, settings)).toBeNull();
    expect(controller.state).toBe('IDLE');
    expect(controller.update(thumbs, thumbs.anchor, 1460, settings)).toBeNull();
    controller.trackingLost();
    expect(controller.state).toBe('IDLE');
    expect(controller.update(thumbs, thumbs.anchor, 1800, settings)).toBeNull();
    expect(controller.update(thumbs, thumbs.anchor, 2059, settings)).toBeNull();
    expect(controller.update(thumbs, thumbs.anchor, 2060, settings)).not.toBeNull();
  });
  it('honors disabled slots and validates only live bounded events', () => {
    const settings = defaults(); settings.reactionSlots[0].enabled = false;
    const controller = new ReactionController(0, 0);
    expect(controller.update(thumbs, thumbs.anchor, 0, settings)).toBeNull();
    const event = { id: 'reaction-1', type: 'thumbs-up', emoji: '👍', position: { x: .3, y: .4 }, createdAt: 1000, duration: 2500, intensity: 'normal' } as const;
    expect(validReactionEvent(event, 1200)).toBe(true);
    expect(validReactionEvent(event, 3500)).toBe(false);
    expect(validReactionEvent({ ...event, position: { x: -1, y: .4 } }, 1200)).toBe(false);
  });
});

describe('reaction priority in the interaction controller', () => {
  it('lets the physical left hand react while the physical right hand keeps writing', () => {
    const state = initialState(), phases: string[] = [], events: string[] = [];
    const controller = new InteractionController({ send: command => reduce(state, command), routePinch(_point, phase) { phases.push(phase); }, endPinch() {},
      map: point => ({ x: point.x * 1600, y: point.y * 900 }), showPointer() {}, getState: () => state, toast() {}, reaction: event => events.push(event.type) });
    const rightOpen = shifted(openHand(), .22), rightPinch = shifted(openHand(), .22); rightPinch[4] = { ...rightPinch[8] };
    const leftThumb = shifted(foldedHand(), -.28);
    controller.update(tracked(rightOpen, leftThumb), size, 0, state.settings);
    controller.update(tracked(rightPinch, leftThumb), size, 100, state.settings);
    controller.update(tracked(rightPinch, leftThumb), size, 180, state.settings);
    controller.update(tracked(rightPinch, leftThumb), size, 270, state.settings);
    controller.update(tracked(shifted(rightPinch, .01), leftThumb), size, 320, state.settings);
    expect(events).toEqual(['thumbs-up']);
    expect(phases).toContain('pinchStart'); expect(phases).toContain('pinchHold');
  });
  it('suppresses reactions for confirmation, pause, and close two-hand ownership', () => {
    const state = initialState(), events: string[] = [];
    state.settings.reactionSlots[2].enabled = true;
    let confirming = true;
    const controller = new InteractionController({ send: command => reduce(state, command), routePinch() {}, endPinch() {},
      map: point => ({ x: point.x * 1600, y: point.y * 900 }), showPointer() {}, getState: () => state, toast() {},
      confirmationPending: () => confirming, confirmationPose() {}, reaction: event => events.push(event.type) });
    const right = shifted(openHand(), .22), left = shifted(foldedHand(), -.28), confirmationV = shifted(vSign(), -.28);
    controller.update(tracked(right, confirmationV), size, 0, state.settings); controller.update(tracked(right, confirmationV), size, 400, state.settings);
    confirming = false; state.settings.paused = true;
    controller.update(tracked(right, left), size, 500, state.settings); controller.update(tracked(right, left), size, 900, state.settings);
    state.settings.paused = false;
    const closeLeft = shifted(foldedHand(), .18);
    controller.update(tracked(right, closeLeft), size, 1000, state.settings); controller.update(tracked(right, closeLeft), size, 1400, state.settings);
    expect(events).toEqual([]);
  });
});
