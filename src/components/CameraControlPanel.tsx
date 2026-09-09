/**
 * SAAI AirBoard - Studio Camera & Hardware Management Panel
 */

import React from 'react';
import { Camera, RefreshCw, ShieldCheck, Video, VideoOff, Sliders } from 'lucide-react';
import { CameraBackgroundConfig } from '../types';

export interface CameraControlPanelProps {
  isStreaming: boolean;
  isModelReady: boolean;
  handDetected: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  cameraConfig: CameraBackgroundConfig;
  onSelectDevice: (deviceId: string) => void;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onUpdateCameraConfig: (config: Partial<CameraBackgroundConfig>) => void;
  onRefreshDevices: () => void;
}

export const CameraControlPanel: React.FC<CameraControlPanelProps> = ({
  isStreaming,
  isModelReady,
  handDetected,
  devices,
  selectedDeviceId,
  cameraConfig,
  onSelectDevice,
  onStartCamera,
  onStopCamera,
  onUpdateCameraConfig,
  onRefreshDevices,
}) => {
  return (
    <div
      id="camera-control-panel-card"
      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 text-slate-800"
    >
      {/* Header & Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isStreaming ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Webcam Input</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className={`inline-block w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span className="text-slate-500">{isStreaming ? (handDetected ? 'Hand Tracked' : 'Searching for Hand') : 'Camera Off'}</span>
            </div>
          </div>
        </div>

        {/* Start / Stop Toggle */}
        <button
          id="btn-toggle-camera-stream"
          onClick={isStreaming ? onStopCamera : onStartCamera}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors ${
            isStreaming
              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isStreaming ? (
            <>
              <VideoOff className="w-4 h-4" />
              <span>Stop Camera</span>
            </>
          ) : (
            <>
              <Video className="w-4 h-4" />
              <span>Start Camera</span>
            </>
          )}
        </button>
      </div>

      {/* Device Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600">
          <span>Camera Device</span>
          <button
            id="btn-refresh-camera-devices"
            onClick={onRefreshDevices}
            title="Scan for attached webcams"
            className="text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Scan</span>
          </button>
        </div>
        <select
          id="select-camera-device"
          value={selectedDeviceId}
          onChange={(e) => onSelectDevice(e.target.value)}
          className="w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
        >
          <option value="">Default System Camera</option>
          {devices.map((device, idx) => (
            <option key={device.deviceId || idx} value={device.deviceId}>
              {device.label || `Camera ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Camera Background Customization */}
      <div className="pt-2 border-t border-slate-100 space-y-3">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Feed Display Adjustments
        </div>

        {/* Mirror Feed */}
        <div className="flex items-center justify-between text-xs text-slate-700">
          <span>Mirror Feed Horizontally</span>
          <input
            id="toggle-camera-mirror"
            type="checkbox"
            checked={cameraConfig.mirror}
            onChange={(e) => onUpdateCameraConfig({ mirror: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded"
          />
        </div>

        {/* Dim Overlay */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Dim Camera Feed</span>
            <span>{Math.round(cameraConfig.dim * 100)}%</span>
          </div>
          <input
            id="slider-camera-dim"
            type="range"
            min="0"
            max="0.8"
            step="0.05"
            value={cameraConfig.dim}
            onChange={(e) => onUpdateCameraConfig({ dim: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>

        {/* Soft Blur */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Camera Soft Blur</span>
            <span>{cameraConfig.blur}px</span>
          </div>
          <input
            id="slider-camera-blur"
            type="range"
            min="0"
            max="12"
            step="1"
            value={cameraConfig.blur}
            onChange={(e) => onUpdateCameraConfig({ blur: parseInt(e.target.value, 10) })}
            className="w-full accent-indigo-600"
          />
        </div>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>Camera processing happens locally on this device. Video is not uploaded or recorded.</span>
      </div>
    </div>
  );
};
