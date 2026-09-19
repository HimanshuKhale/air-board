import { describe, expect, it } from 'vitest';
import { recognizeDigit } from '../../src/drawing/digits';
import type { Point, Stroke } from '../../src/core/types';
import { chooseRecognition } from '../../src/drawing/smart-recognition';

const line = (vertices: Point[], steps = 8): Point[] => vertices.slice(0, -1).flatMap((a, i) => Array.from({ length: steps }, (_, j) => ({ x: a.x + (vertices[i + 1].x - a.x) * j / steps, y: a.y + (vertices[i + 1].y - a.y) * j / steps }))).concat(vertices.at(-1)!);
const oval = (cx: number, cy: number, rx: number, ry: number): Point[] => Array.from({ length: 49 }, (_, i) => ({ x: cx + rx * Math.cos(-Math.PI / 2 + i * Math.PI * 2 / 48), y: cy + ry * Math.sin(-Math.PI / 2 + i * Math.PI * 2 / 48) }));
const scale = (points: Point[], sx = 180, sy = 260, ox = 200, oy = 100, jitter = 0): Point[] => points.map((point, i) => ({ x: ox + point.x * sx + Math.sin(i * 1.7) * jitter, y: oy + point.y * sy + Math.cos(i * 1.3) * jitter }));
const ink = (id: string, points: Point[]): Stroke => ({ id, brush: { tool: 'pen', color: '#225c4a', size: 6, opacity: 1 }, points });
const fixtures: Record<string, Point[][]> = {
  '0': [oval(.5, .5, .34, .47)],
  '1': [line([{ x: .36, y: .18 }, { x: .52, y: .04 }, { x: .52, y: .96 }])],
  '2': [line([{ x: .18, y: .2 }, { x: .36, y: .04 }, { x: .72, y: .08 }, { x: .82, y: .28 }, { x: .66, y: .48 }, { x: .16, y: .92 }, { x: .86, y: .92 }])],
  '3': [line([{ x: .2, y: .12 }, { x: .48, y: .02 }, { x: .78, y: .13 }, { x: .56, y: .48 }, { x: .8, y: .62 }, { x: .7, y: .9 }, { x: .34, y: .98 }, { x: .14, y: .86 }])],
  '4': [line([{ x: .72, y: .98 }, { x: .72, y: .04 }, { x: .12, y: .66 }, { x: .9, y: .66 }])],
  '5': [line([{ x: .82, y: .06 }, { x: .22, y: .06 }, { x: .18, y: .48 }, { x: .58, y: .46 }, { x: .82, y: .6 }, { x: .76, y: .88 }, { x: .42, y: .98 }, { x: .14, y: .86 }])],
  '6': [line([{ x: .76, y: .08 }, { x: .42, y: .03 }, { x: .18, y: .34 }, { x: .16, y: .72 }, { x: .34, y: .96 }, { x: .7, y: .9 }, { x: .82, y: .65 }, { x: .66, y: .48 }, { x: .28, y: .52 }, { x: .17, y: .72 }])],
  '7': [line([{ x: .14, y: .08 }, { x: .88, y: .08 }, { x: .42, y: .98 }])],
  '8': [Array.from({ length: 65 }, (_, i) => { const t = i * Math.PI * 2 / 64; return { x: .5 + .3 * Math.sin(2 * t), y: .5 - .46 * Math.cos(t) }; })],
  '9': [line([...oval(.48, .3, .3, .27).slice(0, -1), { x: .77, y: .3 }, { x: .72, y: .72 }, { x: .48, y: .98 }])],
};

describe('local digit recognition fixtures', () => {
  it('recognizes two transformed fixtures for every digit', () => {
    let correct = 0, total = 0;
    for (const [digit, strokes] of Object.entries(fixtures)) for (const variant of [0, 1]) {
      const input = strokes.map((points, i) => ink(`${digit}-${variant}-${i}`, scale(points, variant ? 205 : 180, variant ? 240 : 270, 150 + variant * 20, 80, variant ? 1.5 : .5)));
      const result = recognizeDigit(input); total++; if (result?.digit === digit) correct++;
      expect(result?.digit, `digit ${digit}, variant ${variant}`).toBe(digit);
      expect(result?.object).toMatchObject({ type: 'text', text: digit, color: '#225c4a' });
    }
    expect({ correct, total }).toEqual({ correct: 20, total: 20 });
  });
  it('recognizes bounded two-stroke 4 and 5 fixtures', () => {
    const four = [line([{ x: .68, y: .04 }, { x: .12, y: .65 }, { x: .9, y: .65 }]), line([{ x: .68, y: .04 }, { x: .68, y: .98 }])];
    const five = [line([{ x: .82, y: .06 }, { x: .22, y: .06 }, { x: .18, y: .5 }]), line([{ x: .18, y: .5 }, { x: .6, y: .46 }, { x: .82, y: .66 }, { x: .68, y: .94 }, { x: .28, y: .94 }])];
    expect(recognizeDigit(four.map((points, i) => ink(`4-${i}`, scale(points))))?.digit).toBe('4');
    expect(recognizeDigit(five.map((points, i) => ink(`5-${i}`, scale(points))))?.digit).toBe('5');
  });
  it.each([['6', '9'], ['3', '8']] as const)('keeps deliberately compared %s and %s fixtures distinct', (first, second) => {
    for (const digit of [first, second]) {
      const result = recognizeDigit([ink(`ambiguous-${digit}`, scale(fixtures[digit][0], 195, 245, 170, 95, 1.2))]);
      expect(result?.digit).toBe(digit);
      expect(result?.margin).toBeGreaterThan(0);
    }
  });
  it('rejects tiny and short ambiguous marks', () => {
    expect(recognizeDigit([ink('tiny', [{ x: 10, y: 10 }, { x: 20, y: 20 }])])).toBeNull();
  });
  it('keeps known shape/digit collisions as ink in Mixed mode', () => {
    for (const [value, type] of [['0', 'circle'], ['1', 'line'], ['4', 'triangle']] as const) {
      const recognized = recognizeDigit([ink(`collision-${value}`, scale(fixtures[value][0]))])!;
      const digit = { ...recognized, confidence: .95 };
      const shape = { confidence: .95, object: { ...digit.object, type, text: '' } };
      expect(chooseRecognition('mixed', shape, digit)).toBeNull();
      expect(chooseRecognition('digits', shape, digit)?.kind).toBe('digit');
      expect(chooseRecognition('shapes', shape, digit)?.kind).toBe('shape');
    }
  });
});
