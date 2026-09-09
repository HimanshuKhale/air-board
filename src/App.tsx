/**
 * SAAI AirBoard - Main Application Root
 *
 * Coordinates tracking, drawing engine, multi-window synchronization,
 * keyboard shortcuts, and view routing (Studio vs Presentation).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PresentationView } from './components/PresentationView';
import { StudioView } from './components/StudioView';
import { BackgroundManager, DEFAULT_BACKGROUND_STATE } from './drawing/backgroundManager';
import { DrawingEngine } from './drawing/drawingEngine';
import { ExportCompositor } from './drawing/exportCompositor';
import { HistoryManager } from './drawing/historyManager';
import { BroadcastSyncService } from './sync/broadcastSync';
import { HandTracker } from './tracking/handTracker';
import {
  AirBoardState,
  BackgroundMode,
  BlankPreset,
  CalibrationConfig,
  CameraBackgroundConfig,
  HandPointerEvent,
  PerformanceMetrics,
  ToolType,
} from './types';
import { PerformanceTracker } from './utils/performance';

const INITIAL_CALIBRATION: CalibrationConfig = {
  pinchThreshold: 0.38,
  releaseThreshold: 0.52,
  smoothingFactor: 0.45,
  useOneEuroFilter: true,
  oneEuroMinCutoff: 1.2,
  oneEuroBeta: 0.015,
  oneEuroDCutoff: 1.0,
  mirrorInput: true,
  targetFps: 30,
};

export default function App() {
  // Determine mode from URL path or query params
  const isPresentPath =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/present') ||
      new URLSearchParams(window.location.search).get('mode') === 'present');

  const [currentMode, setCurrentMode] = useState<'studio' | 'present'>(
    isPresentPath ? 'present' : 'studio'
  );

  // Core domain instances
  const historyManager = useMemo(() => new HistoryManager(60), []);
  const backgroundManager = useMemo(() => new BackgroundManager(), []);
  const broadcastSync = useMemo(() => new BroadcastSyncService(), []);
  const handTracker = useMemo(() => new HandTracker(), []);
  const performanceTracker = useMemo(() => new PerformanceTracker(), []);

  // UI & Board State
  const [boardState, setBoardState] = useState<AirBoardState>({
    tool: 'pen',
    color: '#0f172a', // Obsidian default
    size: 6,
    opacity: 1.0,
    background: DEFAULT_BACKGROUND_STATE,
    calibration: INITIAL_CALIBRATION,
    isDebugOpen: false,
    isPresentationActive: false,
  });

  const [drawingEngine, setDrawingEngine] = useState<DrawingEngine | null>(null);
  const [exportCompositor, setExportCompositor] = useState<ExportCompositor | null>(null);
  const [pointer, setPointer] = useState<HandPointerEvent | null>(null);
  const [renderFps, setRenderFps] = useState(60);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Hardware & Camera state
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isCameraStreaming, setIsCameraStreaming] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    inferenceFps: 0,
    renderFps: 60,
    inferenceDurationMs: 0,
    isModelReady: false,
    handDetected: false,
    activeHandCount: 0,
  });

  // State refs for gesture callback closures
  const boardStateRef = useRef(boardState);
  boardStateRef.current = boardState;
  const drawingEngineRef = useRef(drawingEngine);
  drawingEngineRef.current = drawingEngine;

  // Initialize Canvas & Drawing Engine
  const handleCanvasReady = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!drawingEngine) {
        const engine = new DrawingEngine({
          canvas,
          historyManager,
          pixelRatio: window.devicePixelRatio || 1,
        });
        const compositor = new ExportCompositor(engine, backgroundManager);
        setDrawingEngine(engine);
        setExportCompositor(compositor);
        drawingEngineRef.current = engine;
      }
    },
    [historyManager, backgroundManager, drawingEngine]
  );

  // Initialize Hand Tracker and Model
  useEffect(() => {
    let mounted = true;

    async function initTracker() {
      // Local vendored assets in /wasm and /models/hand_landmarker.task
      const ready = await handTracker.initModel('/wasm', '/models/hand_landmarker.task');
      if (mounted) {
        setMetrics((prev) => ({ ...prev, isModelReady: ready }));
      }

      // Enumerate cameras
      const devices = await handTracker.getCameraDevices();
      if (mounted) {
        setCameraDevices(devices);
      }
    }

    initTracker();

    // Subscribe to pointer events
    const unsubPointer = handTracker.onPointer((event) => {
      setPointer(event);

      const engine = drawingEngineRef.current;
      if (!engine) return;

      const currentTool = boardStateRef.current.tool;
      const currentColor = boardStateRef.current.color;
      const currentSize = boardStateRef.current.size;
      const currentOpacity = boardStateRef.current.opacity;

      // Pointer Event to Drawing Engine Dispatch
      if (event.type === 'down') {
        engine.startStroke(event.point, currentTool, currentColor, currentSize, currentOpacity);
      } else if (event.type === 'move') {
        if (engine.isDrawing()) {
          engine.continueStroke(event.point);
        }
      } else if (event.type === 'up') {
        if (engine.isDrawing()) {
          engine.endStroke();
        }
      }
    });

    // Subscribe to tracking metrics
    const unsubMetrics = handTracker.onMetrics((m) => {
      setMetrics((prev) => ({
        ...prev,
        inferenceFps: m.inferenceFps,
        inferenceDurationMs: m.inferenceDurationMs,
        handDetected: m.handDetected,
        isModelReady: m.isModelReady,
      }));
    });

    // Subscribe to status
    const unsubStatus = handTracker.onStatus((status) => {
      setIsCameraStreaming(status.isStreaming);
      setMetrics((prev) => ({ ...prev, isModelReady: status.isModelReady }));
      setVideoElement(handTracker.getVideoElement());
    });

    // History stack updates
    const unsubHistory = historyManager.onChange(() => {
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
    });

    return () => {
      mounted = false;
      unsubPointer();
      unsubMetrics();
      unsubStatus();
      unsubHistory();
      handTracker.destroy();
    };
  }, [handTracker, historyManager]);

  // Request Animation Frame loop for render FPS telemetry
  useEffect(() => {
    let animId: number;
    const renderLoop = () => {
      const fps = performanceTracker.recordRenderFrame();
      setRenderFps(fps);
      animId = requestAnimationFrame(renderLoop);
    };
    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [performanceTracker]);

  // Sync background manager with state
  useEffect(() => {
    const unsubBg = backgroundManager.onChange((newBg) => {
      setBoardState((prev) => ({ ...prev, background: newBg }));
    });
    return unsubBg;
  }, [backgroundManager]);

  // Multi-window synchronization via BroadcastChannel
  useEffect(() => {
    const unsubSync = broadcastSync.onMessage((msg) => {
      if (msg.type === 'TOOL_CHANGE') {
        setBoardState((prev) => ({ ...prev, tool: msg.payload.tool }));
      } else if (msg.type === 'COLOR_CHANGE') {
        setBoardState((prev) => ({ ...prev, color: msg.payload.color }));
      } else if (msg.type === 'SIZE_CHANGE') {
        setBoardState((prev) => ({ ...prev, size: msg.payload.size }));
      } else if (msg.type === 'BACKGROUND_CHANGE') {
        backgroundManager.setState(msg.payload);
        setBoardState((prev) => ({ ...prev, background: msg.payload }));
      } else if (msg.type === 'ACTION_UNDO') {
        historyManager.undo();
      } else if (msg.type === 'ACTION_REDO') {
        historyManager.redo();
      } else if (msg.type === 'ACTION_CLEAR') {
        historyManager.clear();
      } else if (msg.type === 'STATE_SYNC') {
        setBoardState((prev) => ({ ...prev, ...msg.payload }));
      }
    });

    return unsubSync;
  }, [broadcastSync, backgroundManager, historyManager]);

  // Actions
  const handleSelectTool = (tool: ToolType) => {
    setBoardState((prev) => ({ ...prev, tool }));
    broadcastSync.send({ type: 'TOOL_CHANGE', payload: { tool } });
  };

  const handleSelectColor = (color: string) => {
    setBoardState((prev) => ({ ...prev, color }));
    broadcastSync.send({ type: 'COLOR_CHANGE', payload: { color } });
  };

  const handleSelectSize = (size: number) => {
    setBoardState((prev) => ({ ...prev, size }));
    broadcastSync.send({ type: 'SIZE_CHANGE', payload: { size } });
  };

  const handleUndo = () => {
    historyManager.undo();
    broadcastSync.send({ type: 'ACTION_UNDO' });
  };

  const handleRedo = () => {
    historyManager.redo();
    broadcastSync.send({ type: 'ACTION_REDO' });
  };

  const handleClear = () => {
    historyManager.clear();
    broadcastSync.send({ type: 'ACTION_CLEAR' });
  };

  const handleSelectBackgroundMode = (mode: BackgroundMode) => {
    backgroundManager.setMode(mode);
    const updated = backgroundManager.getState();
    setBoardState((prev) => ({ ...prev, background: updated }));
    broadcastSync.send({ type: 'BACKGROUND_CHANGE', payload: updated });
  };

  const handleSelectBlankPreset = (preset: BlankPreset) => {
    backgroundManager.setState({ blank: { ...boardState.background.blank, preset } });
    const updated = backgroundManager.getState();
    setBoardState((prev) => ({ ...prev, background: updated }));
    broadcastSync.send({ type: 'BACKGROUND_CHANGE', payload: updated });
  };

  const handleUpdateCameraConfig = (config: Partial<CameraBackgroundConfig>) => {
    backgroundManager.setState({ camera: { ...boardState.background.camera, ...config } });
    const updated = backgroundManager.getState();
    setBoardState((prev) => ({ ...prev, background: updated }));
    broadcastSync.send({ type: 'BACKGROUND_CHANGE', payload: updated });
  };

  const handleUpdateCalibration = (config: Partial<CalibrationConfig>) => {
    const nextCalibration = { ...boardState.calibration, ...config };
    setBoardState((prev) => ({ ...prev, calibration: nextCalibration }));
    handTracker.applyCalibration(nextCalibration);
  };

  const handleResetCalibrationDefaults = () => {
    setBoardState((prev) => ({ ...prev, calibration: INITIAL_CALIBRATION }));
    handTracker.applyCalibration(INITIAL_CALIBRATION);
  };

  const handleToggleDebug = () => {
    setBoardState((prev) => ({ ...prev, isDebugOpen: !prev.isDebugOpen }));
  };

  const handleStartCamera = async () => {
    await handTracker.startCamera(selectedCameraId || undefined);
    setVideoElement(handTracker.getVideoElement());
  };

  const handleStopCamera = () => {
    handTracker.stopCamera();
    setVideoElement(null);
  };

  const handleSelectCameraDevice = (id: string) => {
    setSelectedCameraId(id);
    if (isCameraStreaming) {
      handTracker.startCamera(id || undefined);
    }
  };

  const handleRefreshDevices = async () => {
    const devices = await handTracker.getCameraDevices();
    setCameraDevices(devices);
  };

  const handleOpenPresentationWindow = () => {
    // Open clean presentation view in separate window for second monitor / OBS / Meet sharing
    const presentUrl = `${window.location.origin}${window.location.pathname}?mode=present`;
    window.open(presentUrl, '_blank', 'noopener,noreferrer,width=1280,height=720');
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing when typing in inputs
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'p') {
        handleSelectTool('pen');
      } else if (e.key.toLowerCase() === 'e') {
        handleSelectTool('eraser');
      } else if (e.key.toLowerCase() === 'h') {
        handleSelectTool('highlighter');
      } else if (e.key.toLowerCase() === 'd') {
        handleToggleDebug();
      } else if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return currentMode === 'present' ? (
    <PresentationView
      state={boardState}
      drawingEngine={drawingEngine}
      historyManager={historyManager}
      backgroundManager={backgroundManager}
      exportCompositor={exportCompositor}
      handTracker={handTracker}
      pointer={pointer}
      metrics={metrics}
      renderFps={renderFps}
      videoElement={videoElement}
      canUndo={canUndo}
      canRedo={canRedo}
      onSelectTool={handleSelectTool}
      onSelectColor={handleSelectColor}
      onSelectSize={handleSelectSize}
      onUndo={handleUndo}
      onRedo={handleRedo}
      onClear={handleClear}
      onSelectBackgroundMode={handleSelectBackgroundMode}
      onSelectBlankPreset={handleSelectBlankPreset}
      onUpdateCalibration={handleUpdateCalibration}
      onResetCalibrationDefaults={handleResetCalibrationDefaults}
      onToggleDebug={handleToggleDebug}
      onCanvasReady={handleCanvasReady}
      onReturnToStudio={() => setCurrentMode('studio')}
    />
  ) : (
    <StudioView
      state={boardState}
      drawingEngine={drawingEngine}
      historyManager={historyManager}
      backgroundManager={backgroundManager}
      exportCompositor={exportCompositor}
      handTracker={handTracker}
      pointer={pointer}
      metrics={metrics}
      renderFps={renderFps}
      videoElement={videoElement}
      cameraDevices={cameraDevices}
      selectedCameraId={selectedCameraId}
      isCameraStreaming={isCameraStreaming}
      canUndo={canUndo}
      canRedo={canRedo}
      onSelectTool={handleSelectTool}
      onSelectColor={handleSelectColor}
      onSelectSize={handleSelectSize}
      onUndo={handleUndo}
      onRedo={handleRedo}
      onClear={handleClear}
      onSelectBackgroundMode={handleSelectBackgroundMode}
      onSelectBlankPreset={handleSelectBlankPreset}
      onUpdateCameraConfig={handleUpdateCameraConfig}
      onUpdateCalibration={handleUpdateCalibration}
      onResetCalibrationDefaults={handleResetCalibrationDefaults}
      onToggleDebug={handleToggleDebug}
      onStartCamera={handleStartCamera}
      onStopCamera={handleStopCamera}
      onSelectCameraDevice={handleSelectCameraDevice}
      onRefreshDevices={handleRefreshDevices}
      onOpenPresentationWindow={handleOpenPresentationWindow}
      onCanvasReady={handleCanvasReady}
    />
  );
}
