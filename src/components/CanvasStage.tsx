/**
 * SAAI AirBoard - Multi-Layer Canvas Stage
 *
 * Implements strict layer separation:
 *  1. Background Layer (Webcam, Uploaded Image, Blank Board)
 *  2. Drawing Layer (Independent transparent canvas managed by DrawingEngine)
 *  3. Transient Cursor Overlay (Never drawn into exported PNG)
 *  4. UI / Toolbar Layer
 */

import React, { useEffect, useRef, useState } from 'react';
import { BackgroundManager } from '../drawing/backgroundManager';
import { DrawingEngine } from '../drawing/drawingEngine';
import { HistoryManager } from '../drawing/historyManager';
import { BackgroundState, HandPointerEvent, ToolType } from '../types';
import { CursorOverlay } from './CursorOverlay';

export interface CanvasStageProps {
  drawingEngine: DrawingEngine | null;
  historyManager: HistoryManager;
  backgroundManager: BackgroundManager;
  backgroundState: BackgroundState;
  videoElement: HTMLVideoElement | null;
  pointer: HandPointerEvent | null;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  isPresentationMode: boolean;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  drawingEngine,
  historyManager,
  backgroundManager,
  backgroundState,
  videoElement,
  pointer,
  tool,
  color,
  size,
  opacity,
  isPresentationMode,
  onCanvasReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDrawing, setIsMouseDrawing] = useState(false);

  // Mount canvas and register ResizeObserver
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    onCanvasReady(canvas);

    const updateSize = () => {
      if (!containerRef.current || !drawingEngine) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      drawingEngine.setCanvasSize(rect.width, rect.height, dpr);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(containerRef.current);
    updateSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [drawingEngine, onCanvasReady]);

  // Handle Video Element attachment for Camera Background
  useEffect(() => {
    const targetContainer = videoContainerRef.current;
    if (!targetContainer) return;

    if (backgroundState.mode === 'camera' && videoElement) {
      if (!targetContainer.contains(videoElement)) {
        targetContainer.innerHTML = '';
        videoElement.className = `w-full h-full ${
          backgroundState.camera.fit === 'contain' ? 'object-contain' : 'object-cover'
        }`;
        videoElement.style.transform = backgroundState.camera.mirror ? 'scaleX(-1)' : 'none';
        videoElement.style.filter = `blur(${backgroundState.camera.blur}px)`;
        videoElement.style.opacity = `${backgroundState.camera.opacity}`;
        targetContainer.appendChild(videoElement);
      } else {
        videoElement.className = `w-full h-full ${
          backgroundState.camera.fit === 'contain' ? 'object-contain' : 'object-cover'
        }`;
        videoElement.style.transform = backgroundState.camera.mirror ? 'scaleX(-1)' : 'none';
        videoElement.style.filter = `blur(${backgroundState.camera.blur}px)`;
        videoElement.style.opacity = `${backgroundState.camera.opacity}`;
      }
    } else {
      targetContainer.innerHTML = '';
    }
  }, [backgroundState, videoElement]);

  // Mouse fallback handlers (Presenter can draw or click with mouse too)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingEngine || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsMouseDrawing(true);
    drawingEngine.startStroke({ x, y }, tool, color, size, opacity);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDrawing || !drawingEngine || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawingEngine.continueStroke({ x, y });
  };

  const handleMouseUp = () => {
    if (isMouseDrawing && drawingEngine) {
      drawingEngine.endStroke();
      setIsMouseDrawing(false);
    }
  };

  // Determine Background Appearance
  const getBlankBackgroundColor = () => {
    if (backgroundState.blank.preset === 'whiteboard') return '#ffffff';
    if (backgroundState.blank.preset === 'blackboard') return '#1a2332';
    return backgroundState.blank.color;
  };

  return (
    <div
      ref={containerRef}
      id="saai-canvas-stage-root"
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        backgroundColor:
          backgroundState.mode === 'blank' ? getBlankBackgroundColor() : '#000000',
      }}
    >
      {/* LAYER 1: Background Surface */}
      <div id="layer-background" className="absolute inset-0 pointer-events-none z-0">
        {/* Camera Feed */}
        <div
          ref={videoContainerRef}
          id="camera-background-container"
          className={`w-full h-full ${backgroundState.mode === 'camera' ? 'block' : 'hidden'}`}
        />
        {backgroundState.mode === 'camera' && backgroundState.camera.dim > 0 && (
          <div
            id="camera-dimmer-overlay"
            className="absolute inset-0 bg-black"
            style={{ opacity: backgroundState.camera.dim }}
          />
        )}

        {/* Local Image */}
        {backgroundState.mode === 'image' && backgroundState.image.dataUrl && (
          <div id="image-background-container" className="w-full h-full flex items-center justify-center">
            <img
              src={backgroundState.image.dataUrl}
              alt="Custom Board Background"
              className={`w-full h-full ${
                backgroundState.image.fit === 'cover'
                  ? 'object-cover'
                  : backgroundState.image.fit === 'stretch'
                  ? 'object-fill'
                  : 'object-contain'
              }`}
              style={{ opacity: backgroundState.image.opacity }}
            />
          </div>
        )}

        {/* Blank Board Grid / Dots */}
        {backgroundState.mode === 'blank' && backgroundState.blank.gridPattern !== 'none' && (
          <div
            id="blank-grid-overlay"
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage:
                backgroundState.blank.gridPattern === 'grid'
                  ? `linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)`
                  : backgroundState.blank.gridPattern === 'lines'
                  ? `linear-gradient(to bottom, #888 1px, transparent 1px)`
                  : `radial-gradient(circle, #888 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        )}
      </div>

      {/* LAYER 2: Drawing Layer (Transparent Canvas) */}
      <canvas
        ref={canvasRef}
        id="saai-drawing-canvas"
        className="absolute inset-0 z-10 touch-none cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* LAYER 3: Transient Cursor / Hand Indicator (Excluded from Export) */}
      <CursorOverlay
        pointer={pointer}
        tool={tool}
        color={color}
        size={size}
        isPresentationMode={isPresentationMode}
      />
    </div>
  );
};
