/**
 * SAAI AirBoard - Studio View (Control & Setup Interface)
 *
 * Full teacher workspace with camera management, live drawing canvas,
 * hardware calibration, background switcher, and presentation launcher.
 */

import React, { useRef, useState } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Tv,
  HelpCircle,
  Upload,
} from 'lucide-react';
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
  CameraBackgroundConfig,
  HandPointerEvent,
  PerformanceMetrics,
  ToolType,
} from '../types';
import { CalibrationModal } from './CalibrationModal';
import { CameraControlPanel } from './CameraControlPanel';
import { CanvasStage } from './CanvasStage';
import { DebugOverlay } from './DebugOverlay';
import { ExportModal } from './ExportModal';
import { Toolbar } from './Toolbar';

export interface StudioViewProps {
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
  cameraDevices: MediaDeviceInfo[];
  selectedCameraId: string;
  isCameraStreaming: boolean;
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
  onUpdateCameraConfig: (config: Partial<CameraBackgroundConfig>) => void;
  onUpdateCalibration: (config: Partial<CalibrationConfig>) => void;
  onResetCalibrationDefaults: () => void;
  onToggleDebug: () => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onSelectCameraDevice: (id: string) => void;
  onRefreshDevices: () => void;
  onOpenPresentationWindow: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
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
  cameraDevices,
  selectedCameraId,
  isCameraStreaming,
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
  onUpdateCameraConfig,
  onUpdateCalibration,
  onResetCalibrationDefaults,
  onToggleDebug,
  onStartCamera,
  onStopCamera,
  onSelectCameraDevice,
  onRefreshDevices,
  onOpenPresentationWindow,
  onCanvasReady,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await backgroundManager.loadLocalImage(file);
      onSelectBackgroundMode('image');
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div id="saai-studio-root" className="flex flex-col w-screen h-screen bg-slate-100 overflow-hidden select-none font-sans">
      {/* Top Studio Header */}
      <header
        id="studio-header"
        className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-200 z-30 shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-slate-900">SAAI AirBoard</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  STUDIO
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Contactless Presenter Whiteboard</p>
            </div>
          </div>
        </div>

        {/* Center Quick Stats */}
        <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isCameraStreaming ? (pointer?.handDetected ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-300'
              }`}
            />
            <span>
              {isCameraStreaming
                ? pointer?.handDetected
                  ? 'Hand Tracking Active'
                  : 'Searching Hand'
                : 'Webcam Ready'}
            </span>
          </div>

          <div className="h-3.5 w-px bg-slate-200" />

          <div className="text-slate-500">
            Background: <span className="font-semibold text-slate-700 capitalize">{state.background.mode}</span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          <button
            id="btn-keyboard-shortcuts-help"
            onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
            title="Keyboard Shortcuts"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            id="btn-header-present"
            onClick={onOpenPresentationWindow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Tv className="w-4 h-4" />
            <span>Launch Presentation View</span>
          </button>

          <button
            id="btn-toggle-studio-sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? 'Collapse Settings Drawer' : 'Open Settings Drawer'}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Central Canvas Stage */}
        <div id="studio-canvas-container" className="relative flex-1 h-full overflow-hidden">
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
            isPresentationMode={false}
            onCanvasReady={onCanvasReady}
          />

          {/* Floating Bottom Primary Toolbar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
            <Toolbar
              tool={state.tool}
              color={state.color}
              size={state.size}
              canUndo={canUndo}
              canRedo={canRedo}
              backgroundMode={state.background.mode}
              blankPreset={state.background.blank.preset}
              isDebugOpen={state.isDebugOpen}
              isFullscreen={false}
              isPresentationMode={false}
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
              onOpenPresentationWindow={onOpenPresentationWindow}
            />
          </div>

          {/* Real-Time Telemetry Overlay */}
          <DebugOverlay
            isOpen={state.isDebugOpen}
            metrics={metrics}
            pointer={pointer}
            renderFps={renderFps}
          />
        </div>

        {/* Studio Right Sidebar Panel */}
        {isSidebarOpen && (
          <aside
            id="studio-right-sidebar"
            className="w-80 bg-slate-50 border-l border-slate-200 overflow-y-auto p-4 space-y-4 shrink-0 shadow-sm z-30"
          >
            {/* Camera Management Panel */}
            <CameraControlPanel
              isStreaming={isCameraStreaming}
              isModelReady={metrics.isModelReady}
              handDetected={pointer?.handDetected ?? false}
              devices={cameraDevices}
              selectedDeviceId={selectedCameraId}
              cameraConfig={state.background.camera}
              onSelectDevice={onSelectCameraDevice}
              onStartCamera={onStartCamera}
              onStopCamera={onStopCamera}
              onUpdateCameraConfig={onUpdateCameraConfig}
              onRefreshDevices={onRefreshDevices}
            />

            {/* Hidden image input */}
            <input
              ref={fileInputRef}
              id="file-input-image-upload"
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleImageFileChange}
              className="hidden"
            />
          </aside>
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsHelp && (
        <div
          id="shortcuts-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">P</span>
                <span className="font-semibold text-slate-900">Pen Tool</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">H</span>
                <span className="font-semibold text-slate-900">Highlighter Tool</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">E</span>
                <span className="font-semibold text-slate-900">Eraser Tool</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Ctrl + Z</span>
                <span className="font-semibold text-slate-900">Undo Stroke</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Ctrl + Y / Shift+Ctrl+Z</span>
                <span className="font-semibold text-slate-900">Redo Stroke</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">F</span>
                <span className="font-semibold text-slate-900">Toggle Fullscreen</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">D</span>
                <span className="font-semibold text-slate-900">Toggle Diagnostics</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">T</span>
                <span className="font-semibold text-slate-900">Show/Hide Toolbar</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
