/**
 * SAAI AirBoard - On-Screen Hand Pointer & Brush Indicator Overlay
 *
 * Renders the presenter's tracked finger position, current brush diameter,
 * tool badge, and pinch engagement state on a transient 60 FPS overlay.
 */

import React from 'react';
import { HandPointerEvent, ToolType } from '../types';

export interface CursorOverlayProps {
  pointer: HandPointerEvent | null;
  tool: ToolType;
  color: string;
  size: number;
  isPresentationMode: boolean;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({
  pointer,
  tool,
  color,
  size,
  isPresentationMode,
}) => {
  if (!pointer || !pointer.handDetected) {
    return null;
  }

  const { x, y } = pointer.point;
  const isPinching = pointer.isPinching;
  const radius = Math.max(8, size / 2);

  // Dynamic visual style based on tool and pinch phase
  const cursorBorderColor =
    tool === 'eraser'
      ? '#f43f5e'
      : tool === 'highlighter'
      ? '#eab308'
      : color;

  return (
    <div
      id="saai-cursor-container"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      <div
        id="saai-hand-cursor"
        className="absolute transition-transform will-change-transform"
        style={{
          transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`,
        }}
      >
        {/* Outer Pinch Response Ring */}
        <div
          className={`rounded-full flex items-center justify-center transition-all duration-75 ${
            isPinching
              ? 'scale-100 shadow-md ring-2 ring-offset-1'
              : 'scale-125 opacity-70 border-dashed'
          }`}
          style={{
            width: `${Math.max(24, radius * 2)}px`,
            height: `${Math.max(24, radius * 2)}px`,
            borderWidth: isPinching ? '2.5px' : '1.5px',
            borderColor: cursorBorderColor,
            backgroundColor: isPinching
              ? tool === 'eraser'
                ? 'rgba(244, 63, 94, 0.25)'
                : tool === 'highlighter'
                ? 'rgba(234, 179, 8, 0.25)'
                : `${color}33`
              : 'transparent',
          }}
        >
          {/* Inner Fingertip Center Core */}
          <div
            className={`rounded-full transition-transform ${
              isPinching ? 'scale-125 shadow-sm' : 'scale-100'
            }`}
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: isPinching ? cursorBorderColor : '#0f172a',
            }}
          />
        </div>

        {/* Floating Tool Badge (Unobtrusive for learners) */}
        {!isPresentationMode && (
          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-tight shadow-sm whitespace-nowrap select-none transition-opacity ${
              isPinching ? 'opacity-90 bg-slate-900 text-white' : 'opacity-60 bg-white/90 text-slate-700 border border-slate-200'
            }`}
          >
            {isPinching ? `Drawing: ${tool}` : `Pointer (${Math.round((1 - pointer.normalizedDistance) * 100)}%)`}
          </div>
        )}
      </div>
    </div>
  );
};
