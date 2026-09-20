import type { ReactionEmoji, ReactionEvent, ReactionGesture } from '../core/types';

export const REACTION_GESTURES: ReactionGesture[] = ['thumbs-up', 'finger-heart', 'v-sign', 'shaka'];
export const REACTION_EMOJIS: ReactionEmoji[] = ['👍', '❤️', '🎉', '🤙', '👏', '⭐'];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validReactionEvent(value: unknown, now = Date.now()): value is ReactionEvent {
  if (!object(value) || typeof value.id !== 'string' || value.id.length < 8 || value.id.length > 100 || !REACTION_GESTURES.includes(value.type as ReactionGesture) || !REACTION_EMOJIS.includes(value.emoji as ReactionEmoji) ||
    !object(value.position) || typeof value.position.x !== 'number' || typeof value.position.y !== 'number' || !Number.isFinite(value.position.x) || !Number.isFinite(value.position.y) || value.position.x < 0 || value.position.x > 1 || value.position.y < 0 || value.position.y > 1 ||
    typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration < 800 || value.duration > 5000 ||
    (value.intensity !== 'subtle' && value.intensity !== 'normal')) return false;
  return value.createdAt <= now + 5000 && value.createdAt + value.duration > now;
}
