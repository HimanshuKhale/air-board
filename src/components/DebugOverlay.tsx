/**
 * SAAI AirBoard - Diagnostics & Real-Time Performance Telemetry Overlay
 *
 * Excluded from exports and disabled by default in classroom presentations.
 */

import React from 'react';
import { Activity, Cpu, Hand, Zap } from 'lucide-react';
import { HandPointerEvent, PerformanceMetrics } from '../types';

export interface DebugOverlayProps {
  isOpen: boolean;
  metrics: PerformanceMetrics;
  pointer: HandPointerEvent | null;
  renderFps: number;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  isOpen,
  metrics,
  pointer,
  renderFps,
}) => {
  if (!isOpen) return null;

  const landmarks = pointer?.landmarks;
  const thumbTip = landmarks && landmarks[4] ? landmarks[4] : null;
  const indexTip = landmarks && landmarks[8] ? landmarks[8] : null;

  return (
    <div
      id="saai-debug-telemetry-overlay"
      className="fixed top-4 left-4 z-40 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 text-xs font-mono text-slate-200 shadow-2xl space-y-3 pointer-events-none select-none"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
          <Activity className="w-4 h-4" />
          <span>SAAI Telemetry</span>
        </div>
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-sans font-semibold">
          DEBUG
        </span>
      </div>

      {/* Frame Rates */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Render FPS</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">{renderFps}</div>
        </div>
        <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-400" />
            <span>Inference FPS</span>
          </div>
          <div className="text-lg font-bold text-blue-400">{metrics.inferenceFps}</div>
        </div>
      </div>

      {/* Tracking Metrics */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-400">Inference Latency:</span>
          <span className="text-slate-100 font-semibold">{metrics.inferenceDurationMs} ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Model State:</span>
          <span className={metrics.isModelReady ? 'text-emerald-400' : 'text-rose-400'}>
            {metrics.isModelReady ? 'Local WASM Ready' : 'Loading...'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Hand Presence:</span>
          <span className={metrics.handDetected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {metrics.handDetected ? 'DETECTED' : 'SEARCHING'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Pinch Phase:</span>
          <span className={pointer?.isPinching ? 'text-rose-400 font-bold' : 'text-slate-300'}>
            {pointer?.pinchPhase.toUpperCase() ?? 'IDLE'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Palm Ratio:</span>
          <span className="text-slate-200">
            {pointer ? pointer.normalizedDistance.toFixed(3) : '0.000'}
          </span>
        </div>
      </div>

      {/* Coordinate Telemetry */}
      {pointer && pointer.handDetected && (
        <div className="pt-2 border-t border-slate-800 space-y-1 text-[10px] text-slate-400">
          <div>
            Raw Index: ({pointer.rawNormalized.x.toFixed(3)}, {pointer.rawNormalized.y.toFixed(3)})
          </div>
          <div>
            Smoothed: ({pointer.smoothedNormalized.x.toFixed(3)}, {pointer.smoothedNormalized.y.toFixed(3)})
          </div>
          <div>
            Canvas Px: ({Math.round(pointer.point.x)}, {Math.round(pointer.point.y)})
          </div>
        </div>
      )}
    </div>
  );
};
