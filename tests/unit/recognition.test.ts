import { expect, it } from 'vitest';
import { recognizeStroke } from '../../src/drawing/recognition';
import type { Point, Stroke } from '../../src/core/types';
const ink = (points: Point[]): Stroke => ({ id: 'rough', brush: { tool: 'pen', color: '#da5650', size: 8, opacity: 1 }, points });
const interpolate = (vertices: Point[], steps = 12): Point[] => vertices.slice(0, -1).flatMap((a, i) => Array.from({ length: steps }, (_, j) => ({ x: a.x + (vertices[i + 1].x - a.x) * j / steps, y: a.y + (vertices[i + 1].y - a.y) * j / steps }))).concat(vertices.at(-1)!);
it('recognizes clear line, rectangle, ellipse, triangle and arrow fixtures', () => {
  const line = interpolate([{ x: 100, y: 120 }, { x: 450, y: 290 }]);
  const rectangle = interpolate([{ x: 100, y: 100 }, { x: 360, y: 102 }, { x: 358, y: 270 }, { x: 102, y: 269 }, { x: 100, y: 100 }]);
  const ellipse = Array.from({ length: 81 }, (_, i) => ({ x: 300 + 130 * Math.cos(i * Math.PI / 40), y: 300 + 90 * Math.sin(i * Math.PI / 40) }));
  const triangle = interpolate([{ x: 240, y: 80 }, { x: 380, y: 300 }, { x: 100, y: 300 }, { x: 240, y: 80 }]);
  const arrow = interpolate([{ x: 100, y: 200 }, { x: 400, y: 200 }, { x: 350, y: 170 }, { x: 400, y: 200 }, { x: 350, y: 230 }]);
  expect(recognizeStroke(ink(line))?.object.type).toBe('line');
  expect(recognizeStroke(ink(rectangle))?.object.type).toBe('rectangle');
  expect(recognizeStroke(ink(ellipse))?.object.type).toBe('ellipse');
  expect(recognizeStroke(ink(triangle))?.object.type).toBe('triangle');
  expect(recognizeStroke(ink(arrow))?.object.type).toBe('arrow');
  expect(recognizeStroke(ink(rectangle))?.object).toMatchObject({ color: '#da5650', strokeWidth: 8 });
});
it('avoids short handwriting and open A, D, and arrow-like scribbles', () => {
  const smallO = Array.from({ length: 32 }, (_, i) => ({ x: 100 + 18 * Math.cos(i * Math.PI / 16), y: 100 + 24 * Math.sin(i * Math.PI / 16) }));
  const letterA = interpolate([{ x: 100, y: 300 }, { x: 200, y: 90 }, { x: 300, y: 300 }, { x: 160, y: 200 }, { x: 245, y: 200 }]);
  const scribble = interpolate([{ x: 100, y: 100 }, { x: 300, y: 250 }, { x: 130, y: 290 }, { x: 330, y: 110 }]);
  expect(recognizeStroke(ink(smallO))).toBeNull();
  expect(recognizeStroke(ink(letterA))).toBeNull();
  expect(recognizeStroke(ink(scribble))).toBeNull();
});
