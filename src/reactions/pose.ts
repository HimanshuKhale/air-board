import type { Point, ReactionGesture, Size } from '../core/types';
import { classifyConfirmationPose, classifyFourFingertipPinch, fingerExtensionScores, palmCenter, thumbExtensionScore } from '../interaction/pose';

export interface ReactionPose { gesture: ReactionGesture | 'neutral'; confidence: number; anchor: Point }
const distance = (a: Point, b: Point, size: Size) => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
const palmScale = (points: Point[], size: Size) => Math.max(1, (distance(points[0], points[9], size) + distance(points[5], points[17], size)) / 2);

/** Conservative landmark-only reactions. Finger-heart still needs real-camera acceptance for occlusion and depth. */
export function classifyReactionPose(points: Point[], size: Size): ReactionPose {
  const neutral = { gesture: 'neutral' as const, confidence: 0, anchor: points.length === 21 ? palmCenter(points) : { x: .5, y: .5 } };
  if (points.length !== 21 || size.width <= 0 || size.height <= 0 || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return neutral;
  const fingers = fingerExtensionScores(points, size), thumb = thumbExtensionScore(points, size), palm = palmCenter(points), scale = palmScale(points, size);
  const folded = fingers.map(score => 1 - score);
  const thumbConfidence = Math.min(thumb, ...folded);
  if (thumb >= .68 && fingers.every(score => score <= .35)) return { gesture: 'thumbs-up', confidence: thumbConfidence, anchor: points[4] };

  const tipDistance = distance(points[4], points[8], size) / scale;
  const middleClearance = distance(points[4], points[12], size) / scale;
  const heartAnchor = { x: (points[4].x + points[8].x) / 2, y: (points[4].y + points[8].y) / 2 };
  const away = distance(heartAnchor, palm, size) / scale;
  const heartConfidence = Math.max(0, Math.min(1,
    (0.36 - tipDistance) / .2,
    (middleClearance - .55) / .35,
    (away - .32) / .3,
    thumb,
    1 - fingers[0], 1 - fingers[1], 1 - fingers[2], 1 - fingers[3],
  ));
  const fiveTipCluster = classifyFourFingertipPinch(points, size).active;
  if (!fiveTipCluster && tipDistance <= .28 && middleClearance >= .62 && away >= .4 && thumb >= .48 && fingers[0] <= .5 && fingers.slice(1).every(score => score <= .4)) {
    return { gesture: 'finger-heart', confidence: heartConfidence, anchor: heartAnchor };
  }

  const confirmation = classifyConfirmationPose(points, size);
  if (confirmation.gesture === 'CONFIRM_YES') return { gesture: 'v-sign', confidence: confirmation.confidence, anchor: palm };
  if (confirmation.gesture === 'CONFIRM_NO') return { gesture: 'shaka', confidence: confirmation.confidence, anchor: palm };
  return neutral;
}
