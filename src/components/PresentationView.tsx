/**
 * SAAI AirBoard - Presentation View (Screen-Share Surface)
 *
 * Minimal, zero-distraction view for video conferences and second monitors.
 * Features auto-hiding floating controls (revealed on bottom edge proximity or 'T' key),
 * fullscreen toggle ('F'), and synchronized multi-window state.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Tv } from 'lucide-react';
import { BackgroundManager } from '../drawing/backgroundManager';
import { DrawingEngine } from '../drawing/drawingEngine';
import { ExportCompositor } from '../drawing/exportCompositor';
import { HistoryManager } from '../drawing/historyManager';
import { HandTracker } from '../tracking/handTracker';
import {
  AirBoardState,
  BackgroundMode,
  BlankPreset,
  CalibrationConfig,
  HandPointerEvent,
  PerformanceMetrics,
  ToolType,
} from '../types';
import { CalibrationModal } from './CalibrationModal';
import { CanvasStage } from './CanvasStage';
import { DebugOverlay } from './DebugOverlay';
import { ExportModal } from './ExportModal';
import { Toolbar } from './Toolbar';

export interface PresentationViewProps {
  state: AirBoardState;
  drawingEngine: DrawingEngine | null;
  historyManager: HistoryManager;
  backgroundManager: BackgroundManager;
  exportCompositor: ExportCompositor | null;
  handTracker: HandTracker;
  pointer: HandPointerEvent | null;
  metrics: PerformanceMetrics;
  renderFps: number;
  videoElement: HTMLVideoElement | null;
  canUndo: boolean;
  canRedo: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSelectBackgroundMode: (mode: BackgroundMode) => void;
  onSelectBlankPreset: (preset: BlankPreset) => void;
  onUpdateCalibration: (config: Partial<CalibrationConfig>) => void;
  onResetCalibrationDefaults: () => void;
  onToggleDebug: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onReturnToStudio?: () => void;
}

export const PresentationView: React.FC<PresentationViewProps> = ({
  state,
  drawingEngine,
  historyManager,
  backgroundManager,
  exportCompositor,
  handTracker,
  pointer,
  metrics,
  renderFps,
  videoElement,
  canUndo,
  canRedo,
  onSelectTool,
  onSelectColor,
  onSelectSize,
  onUndo,
  onRedo,
  onClear,
  onSelectBackgroundMode,
  onSelectBlankPreset,
  onUpdateCalibration,
  onResetCalibrationDefaults,
  onToggleDebug,
  onCanvasReady,
  onReturnToStudio,
}) => {
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-hide toolbar logic: hide after 3.5s of no bottom-screen activity
  const resetHideTimer = () => {
    setIsToolbarVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setIsToolbarVisible(false);
    }, 4000);
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Show toolbar when hand pointer or mouse moves near bottom 140px
  useEffect(() => {
    if (pointer && pointer.handDetected) {
      const windowHeight = window.innerHeight;
      if (pointer.point.y > windowHeight - 140) {
        setIsToolbarVisible(true);
        resetHideTimer();
      }
    }
  }, [pointer]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.clientY > window.innerHeight - 140) {
      setIsToolbarVisible(true);
      resetHideTimer();
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcut toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        setIsToolbarVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await backgroundManager.loadLocalImage(file);
      onSelectBackgroundMode('image');
    }
  };

  return (
    <div
      id="saai-presentation-root"
      className="relative w-screen h-screen bg-black overflow-hidden select-none cursor-default font-sans"
      onMouseMove={handleMouseMove}
    >
      {/* Full Screen Surface Stage */}
      <CanvasStage
        drawingEngine={drawingEngine}
        historyManager={historyManager}
        backgroundManager={backgroundManager}
        backgroundState={state.background}
        videoElement={videoElement}
        pointer={pointer}
        tool={state.tool}
        color={state.color}
        size={state.size}
        opacity={state.opacity}
        isPresentationMode={true}
        onCanvasReady={onCanvasReady}
      />

      {/* Auto-Hiding Floating Minimal Toolbar */}
      <div
        id="presentation-floating-toolbar"
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ${
          isToolbarVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-20 opacity-0 pointer-events-none'
        }`}
      >
        <Toolbar
          tool={state.tool}
          color={state.color}
          size={state.size}
          canUndo={canUndo}
          canRedo={canRedo}
          backgroundMode={state.background.mode}
          blankPreset={state.background.blank.preset}
          isDebugOpen={state.isDebugOpen}
          isFullscreen={isFullscreen}
          isPresentationMode={true}
          onSelectTool={onSelectTool}
          onSelectColor={onSelectColor}
          onSelectSize={onSelectSize}
          onUndo={onUndo}
          onRedo={onRedo}
          onClear={onClear}
          onSelectBackgroundMode={onSelectBackgroundMode}
          onSelectBlankPreset={onSelectBlankPreset}
          onOpenImageUpload={() => fileInputRef.current?.click()}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenCalibration={() => setIsCalibrationOpen(true)}
          onToggleDebug={onToggleDebug}
          onToggleFullscreen={handleToggleFullscreen}
        />
      </div>

      {/* Bottom Proximity Trigger Strip */}
      <div
        id="presentation-bottom-hover-zone"
        className="fixed bottom-0 left-0 right-0 h-10 z-30 pointer-events-auto"
        onMouseEnter={() => {
          setIsToolbarVisible(true);
          resetHideTimer();
        }}
      />

      {/* Subtle Studio Switcher / Exit Fullscreen if needed */}
      {onReturnToStudio && (
        <button
          id="btn-return-to-studio"
          onClick={onReturnToStudio}
          title="Return to Studio Workspace"
          className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/70 text-white/70 hover:text-white text-xs backdrop-blur-md border border-white/10 transition-colors"
        >
          Studio View
        </button>
      )}

      {/* Hidden local image upload input */}
      <input
        ref={fileInputRef}
        id="presentation-image-input"
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Debug Overlay */}
      <DebugOverlay
        isOpen={state.isDebugOpen}
        metrics={metrics}
        pointer={pointer}
        renderFps={renderFps}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        exportCompositor={exportCompositor}
        videoElement={videoElement}
        currentBackgroundMode={state.background.mode}
      />

      {/* Calibration Modal */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        config={state.calibration}
        pointer={pointer}
        onUpdateConfig={onUpdateCalibration}
        onResetDefaults={onResetCalibrationDefaults}
      />
    </div>
  );
};
