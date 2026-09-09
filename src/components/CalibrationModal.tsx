/**
 * SAAI AirBoard - Interactive Calibration & Gesture Tuning Modal
 *
 * Real-time visual feedback for hand detection, normalized pinch distance,
 * threshold tuning, and pointer smoothing filter selection.
 */

import React from 'react';
import { Sliders, CheckCircle2, AlertCircle, RotateCcw, X } from 'lucide-react';
import { CalibrationConfig, HandPointerEvent } from '../types';

export interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CalibrationConfig;
  pointer: HandPointerEvent | null;
  onUpdateConfig: (updated: Partial<CalibrationConfig>) => void;
  onResetDefaults: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  config,
  pointer,
  onUpdateConfig,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  const handDetected = pointer?.handDetected ?? false;
  const isPinching = pointer?.isPinching ?? false;
  const pinchDistance = pointer?.normalizedDistance ?? 1.0;

  // Visual meter percent (0 = touching, 1 = open hand)
  const meterPercent = Math.max(0, Math.min(100, Math.round(pinchDistance * 100)));
  const pinchThresholdPercent = Math.round(config.pinchThreshold * 100);
  const releaseThresholdPercent = Math.round(config.releaseThreshold * 100);

  return (
    <div
      id="calibration-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        id="calibration-modal-content"
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">AirBoard Calibration & Tuning</h2>
              <p className="text-xs text-slate-500">Fine-tune hand tracking, pinch hysteresis, and pointer smoothing</p>
            </div>
          </div>
          <button
            id="btn-close-calibration"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Live Sensor Status Display */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500 uppercase tracking-wider">Live Detection Status</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  {handDetected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}
                  <span className={handDetected ? 'text-emerald-700' : 'text-amber-600'}>
                    {handDetected ? 'Hand In View' : 'Wave Hand At Camera'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isPinching ? 'bg-blue-600 animate-ping' : 'bg-slate-300'
                    }`}
                  />
                  <span className={isPinching ? 'text-blue-700 font-bold' : 'text-slate-500'}>
                    {isPinching ? 'Pinch Active (Drawing)' : 'Hovering'}
                  </span>
                </span>
              </div>
            </div>

            {/* Normalized Pinch Distance Meter */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Pinch Proximity Gauge:</span>
                <span className="font-mono font-medium">
                  {pinchDistance.toFixed(2)}x palm ratio
                </span>
              </div>
              <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
                {/* Visual bar */}
                <div
                  className={`h-full transition-all duration-75 ${
                    isPinching ? 'bg-blue-600' : 'bg-slate-400'
                  }`}
                  style={{ width: `${meterPercent}%` }}
                />
                {/* Pinch Threshold Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                  style={{ left: `${pinchThresholdPercent}%` }}
                  title="Pinch Engagement Threshold"
                />
                {/* Release Threshold Line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10"
                  style={{ left: `${releaseThresholdPercent}%` }}
                  title="Pinch Release Threshold"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                <span>0.0 (Fingertips Touching)</span>
                <span className="text-rose-600 font-semibold">Pinch Start ({config.pinchThreshold})</span>
                <span className="text-emerald-600 font-semibold">Pinch Release ({config.releaseThreshold})</span>
                <span>1.0+ (Open Hand)</span>
              </div>
            </div>
          </div>

          {/* Controls: Pinch Sensitivity */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gesture Thresholds</h3>

            {/* Pinch Threshold */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Pinch Engagement Threshold</span>
                <span className="font-mono text-blue-600">{config.pinchThreshold.toFixed(2)}</span>
              </div>
              <input
                id="slider-pinch-threshold"
                type="range"
                min="0.20"
                max="0.55"
                step="0.01"
                value={config.pinchThreshold}
                onChange={(e) =>
                  onUpdateConfig({ pinchThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600"
              />
              <p className="text-[11px] text-slate-400">
                Lower = requires tighter pinch. Higher = easier to engage drawing.
              </p>
            </div>

            {/* Release Threshold (Hysteresis) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Pinch Release Threshold (Hysteresis Buffer)</span>
                <span className="font-mono text-emerald-600">{config.releaseThreshold.toFixed(2)}</span>
              </div>
              <input
                id="slider-release-threshold"
                type="range"
                min="0.30"
                max="0.75"
                step="0.01"
                value={config.releaseThreshold}
                onChange={(e) =>
                  onUpdateConfig({ releaseThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-600"
              />
              <p className="text-[11px] text-slate-400">
                Prevents accidental stroke interruptions while handwriting. Must be higher than engagement.
              </p>
            </div>
          </div>

          {/* Pointer Smoothing Tuning */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pointer Stabilisation Filter</h3>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-700">One Euro Filter (1€ Filter)</div>
                <div className="text-[11px] text-slate-500">Adaptive tremor suppression with zero handwriting lag</div>
              </div>
              <input
                id="toggle-one-euro"
                type="checkbox"
                checked={config.useOneEuroFilter}
                onChange={(e) => onUpdateConfig({ useOneEuroFilter: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>

            {/* Exponential Moving Average Alpha Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>Responsiveness / Smoothing Factor (Alpha)</span>
                <span className="font-mono text-indigo-600">{config.smoothingFactor.toFixed(2)}</span>
              </div>
              <input
                id="slider-smoothing-factor"
                type="range"
                min="0.15"
                max="0.85"
                step="0.05"
                value={config.smoothingFactor}
                onChange={(e) =>
                  onUpdateConfig({ smoothingFactor: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Heavy Smoothing (Calm)</span>
                <span>Balanced (0.45)</span>
                <span>Fast / Snappy (Immediate)</span>
              </div>
            </div>

            {/* Mirroring Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-semibold text-slate-700">Mirror Camera Input</div>
                <div className="text-[11px] text-slate-500">
                  Moving hand left moves cursor left from your point of view
                </div>
              </div>
              <input
                id="toggle-mirror-input"
                type="checkbox"
                checked={config.mirrorInput}
                onChange={(e) => onUpdateConfig({ mirrorInput: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            id="btn-reset-calibration-defaults"
            onClick={onResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Factory Defaults</span>
          </button>
          <button
            id="btn-save-calibration"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
