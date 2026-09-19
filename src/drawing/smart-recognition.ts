import type { Settings } from '../core/types';
import type { Recognition } from './recognition';
import type { DigitRecognition } from './digits';

export type SmartChoice = { kind: 'shape'; candidate: Recognition } | { kind: 'digit'; candidate: DigitRecognition } | null;
/** Conservative policy keeps the known 0/circle, 1/line and 4/triangle collisions as ink in Mixed mode. */
export function chooseRecognition(mode: Settings['recognitionMode'], shape: Recognition | null, digit: DigitRecognition | null): SmartChoice {
  if (mode === 'shapes') return shape && shape.confidence >= .78 ? { kind: 'shape', candidate: shape } : null;
  if (mode === 'digits') return digit && digit.confidence >= .76 ? { kind: 'digit', candidate: digit } : null;
  if (shape && digit) {
    const ambiguous = shape.object.type === 'circle' && digit.digit === '0' || shape.object.type === 'line' && digit.digit === '1' || shape.object.type === 'triangle' && digit.digit === '4';
    if (ambiguous || Math.abs(shape.confidence - digit.confidence) < .16) return null;
    if (shape.confidence > digit.confidence && shape.confidence >= .86) return { kind: 'shape', candidate: shape };
    if (digit.confidence >= .84) return { kind: 'digit', candidate: digit };
    return null;
  }
  if (shape && shape.confidence >= .86) return { kind: 'shape', candidate: shape };
  if (digit && digit.confidence >= .84) return { kind: 'digit', candidate: digit };
  return null;
}
