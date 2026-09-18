import { describe, expect, it } from 'vitest';
import { applyHomography, homographyFromQuad, invertHomography } from '../../src/calibration/homography';
import { distanceToSegment, nearestStroke, pointInPolygon, selectStrokes, validLasso } from '../../src/selection/geometry';
import type { Point, Stroke } from '../../src/core/types';

const close = (actual: Point, expected: Point) => { expect(actual.x).toBeCloseTo(expected.x, 7); expect(actual.y).toBeCloseTo(expected.y, 7); };
describe('writing-plane homography', () => {
  it('maps an identity rectangle', () => {
    const h = homographyFromQuad([{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]);
    close(applyHomography(h, {x:.27,y:.63}), {x:.27,y:.63});
  });
  it('maps every corner of a skewed perspective quadrilateral', () => {
    const source = [{x:.14,y:.18},{x:.91,y:.08},{x:.78,y:.9},{x:.2,y:.78}];
    const target = [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
    const h = homographyFromQuad(source);
    source.forEach((point, i) => close(applyHomography(h, point), target[i]));
    const mapped = applyHomography(h, {x:.5,y:.45});
    expect(mapped.x).toBeGreaterThan(.3); expect(mapped.x).toBeLessThan(.7);
    expect(mapped.y).toBeGreaterThan(.3); expect(mapped.y).toBeLessThan(.7);
  });
  it('round-trips through its inverse', () => {
    const h = homographyFromQuad([{x:.1,y:.2},{x:.9,y:.12},{x:.82,y:.88},{x:.2,y:.8}]);
    const point = {x:.42,y:.57}; close(applyHomography(invertHomography(h), applyHomography(h, point)), point);
  });
  it.each([
    { points: [{x:0,y:0},{x:0,y:0},{x:1,y:1},{x:0,y:1}] },
    { points: [{x:0,y:0},{x:1,y:1},{x:1,y:0},{x:0,y:1}] },
    { points: [{x:0,y:0},{x:1,y:0},{x:.5,y:.1},{x:0,y:1}] },
  ])('rejects duplicate, crossing, or concave calibration', ({ points }) => expect(() => homographyFromQuad(points)).toThrow());
});

describe('lasso geometry and structured stroke selection', () => {
  const polygon = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:0,y:0}];
  it('uses point-in-polygon with outside rejection', () => {
    expect(pointInPolygon({x:50,y:50}, polygon)).toBe(true);
    expect(pointInPolygon({x:150,y:50}, polygon)).toBe(false);
  });
  it('rejects tiny/open lassos and accepts a sufficiently sampled closed loop', () => {
    expect(validLasso(polygon, 20)).toBe(false);
    const detailed: Point[] = [];
    for (let x=0;x<=100;x+=10) detailed.push({x,y:0});
    for (let y=10;y<=100;y+=10) detailed.push({x:100,y});
    for (let x=90;x>=0;x-=10) detailed.push({x,y:100});
    for (let y=90;y>=0;y-=10) detailed.push({x:0,y});
    expect(validLasso(detailed, 20)).toBe(true);
    expect(validLasso([...detailed.slice(0,-1), {x:80,y:80}], 20)).toBe(false);
  });
  it('requires bounds intersection and at least 30 percent of sampled points inside', () => {
    const stroke = (id: string, points: Point[], tool: 'pen'|'eraser'='pen'): Stroke => ({ id, points, brush: { tool, color:'#000000', size:5, opacity:1 } });
    const selected = selectStrokes([
      stroke('inside', [{x:20,y:20},{x:80,y:80}]),
      stroke('crossing-mostly-out', [{x:-300,y:50},{x:10,y:50}]),
      stroke('outside', [{x:200,y:200},{x:300,y:300}]),
      stroke('eraser', [{x:20,y:20},{x:80,y:80}], 'eraser'),
    ], polygon);
    expect(selected).toEqual(['inside']);
  });
});

describe('fist-grab hit testing', () => {
  const stroke = (id: string, points: Point[], tool: 'pen'|'eraser'='pen'): Stroke => ({ id, points, brush: { tool, color:'#123456', size:6, opacity:.8 } });
  it('measures the nearest point on a segment', () => expect(distanceToSegment({x:50,y:20}, {x:0,y:0}, {x:100,y:0})).toBe(20));
  it('returns the nearest drawable stroke within the grab radius', () => {
    const strokes = [stroke('far', [{x:0,y:100},{x:100,y:100}]), stroke('near', [{x:0,y:10},{x:100,y:10}]), stroke('eraser', [{x:0,y:0},{x:100,y:0}], 'eraser')];
    expect(nearestStroke(strokes, {x:50,y:0}, 20)?.id).toBe('near');
    expect(nearestStroke(strokes, {x:50,y:0}, 5)).toBeNull();
  });
});
