/**
 * SAAI AirBoard - Universal Professional Toolbar
 *
 * Supports both mouse input and contactless hand-pointer pinch selection.
 * Clean, high-contrast, responsive layout with keyboard shortcuts.
 */

import React, { useState } from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Maximize,
  Minimize,
  Sliders,
  Eye,
  EyeOff,
  Video,
  Image as ImageIcon,
  Square,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BackgroundMode, BlankPreset, ToolType } from '../types';

export interface ToolbarProps {
  tool: ToolType;
  color: string;
  size: number;
  canUndo: boolean;
  canRedo: boolean;
  backgroundMode: BackgroundMode;
  blankPreset: BlankPreset;
  isDebugOpen: boolean;
  isFullscreen: boolean;
  isPresentationMode: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onSelectBackgroundMode: (mode: BackgroundMode) => void;
  onSelectBlankPreset: (preset: BlankPreset) => void;
  onOpenImageUpload: () => void;
  onOpenExport: () => void;
  onOpenCalibration: () => void;
  onToggleDebug: () => void;
  onToggleFullscreen: () => void;
  onOpenPresentationWindow?: () => void;
}

const COLOR_PALETTE = [
  { name: 'Obsidian', hex: '#0f172a' },
  { name: 'Ink Blue', hex: '#2563eb' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Crimson', hex: '#dc2626' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Chalk White', hex: '#ffffff' },
  { name: 'Highlighter Yellow', hex: '#facc15' },
];

const BRUSH_SIZES = [
  { label: 'Fine', size: 3 },
  { label: 'Medium', size: 8 },
  { label: 'Thick', size: 16 },
  { label: 'Marker', size: 32 },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  color,
  size,
  canUndo,
  canRedo,
  backgroundMode,
  blankPreset,
  isDebugOpen,
  isFullscreen,
  isPresentationMode,
  onSelectTool,
  onSelectColor,
  onSelectSize,
  onUndo,
  onRedo,
  onClear,
  onSelectBackgroundMode,
  onSelectBlankPreset,
  onOpenImageUpload,
  onOpenExport,
  onOpenCalibration,
  onToggleDebug,
  onToggleFullscreen,
  onOpenPresentationWindow,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearClick = () => {
    if (confirmClear) {
      onClear();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <div
      id="saai-toolbar-container"
      className={`relative z-40 flex items-center gap-1.5 p-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/90 text-slate-800 transition-all select-none ${
        isPresentationMode ? 'hover:opacity-100 opacity-90' : ''
      }`}
    >
      {/* Primary Tools */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-slate-200">
        <button
          id="btn-tool-pen"
          title="Pen (P)"
          onClick={() => onSelectTool('pen')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            tool === 'pen'
              ? 'bg-blue-600 text-white shadow-sm font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Pen className="w-5 h-5" />
        </button>

        <button
          id="btn-tool-highlighter"
          title="Highlighter (H)"
          onClick={() => onSelectTool('highlighter')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            tool === 'highlighter'
              ? 'bg-amber-500 text-white shadow-sm font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Highlighter className="w-5 h-5" />
        </button>

        <button
          id="btn-tool-eraser"
          title="Eraser (E)"
          onClick={() => onSelectTool('eraser')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            tool === 'eraser'
              ? 'bg-rose-600 text-white shadow-sm font-semibold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Eraser className="w-5 h-5" />
        </button>
      </div>

      {/* Color Palette Popover Trigger */}
      <div className="relative">
        <button
          id="btn-color-palette-toggle"
          title="Stroke Color"
          onClick={() => {
            setShowColorPicker(!showColorPicker);
            setShowSizePicker(false);
            setShowBgPicker(false);
          }}
          className="flex items-center gap-1 px-2.5 h-10 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
        >
          <span
            className="w-5 h-5 rounded-full border border-slate-300 shadow-inner"
            style={{ backgroundColor: color }}
          />
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {showColorPicker && (
          <div
            id="color-palette-popover"
            className="absolute bottom-13 left-0 p-3 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-wrap gap-2 w-52 z-50 animate-in fade-in zoom-in-95"
          >
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex}
                id={`btn-color-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                title={c.name}
                onClick={() => {
                  onSelectColor(c.hex);
                  setShowColorPicker(false);
                }}
                className={`w-7 h-7 rounded-full transition-transform border ${
                  color.toLowerCase() === c.hex.toLowerCase()
                    ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
            <div className="w-full pt-2 border-t border-slate-100 flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Custom:</span>
              <input
                id="input-custom-color"
                type="color"
                value={color}
                onChange={(e) => onSelectColor(e.target.value)}
                className="w-7 h-7 p-0 border-0 rounded cursor-pointer bg-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Brush Size Selector */}
      <div className="relative">
        <button
          id="btn-brush-size-toggle"
          title="Brush Size"
          onClick={() => {
            setShowSizePicker(!showSizePicker);
            setShowColorPicker(false);
            setShowBgPicker(false);
          }}
          className="flex items-center gap-1.5 px-2.5 h-10 rounded-xl hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors"
        >
          <div
            className="rounded-full bg-slate-800"
            style={{ width: Math.min(18, Math.max(4, size)), height: Math.min(18, Math.max(4, size)) }}
          />
          <span>{size}px</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {showSizePicker && (
          <div
            id="brush-size-popover"
            className="absolute bottom-13 left-0 p-3 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col gap-2.5 w-48 z-50"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s.size}
                  id={`btn-size-${s.size}`}
                  onClick={() => {
                    onSelectSize(s.size);
                    setShowSizePicker(false);
                  }}
                  className={`py-1 px-2 text-xs rounded-lg font-medium transition-colors ${
                    size === s.size
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {s.label} ({s.size}px)
                </button>
              ))}
            </div>
            <div className="pt-1 flex flex-col gap-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Slider</span>
                <span>{size}px</span>
              </div>
              <input
                id="input-brush-size-slider"
                type="range"
                min="1"
                max="64"
                value={size}
                onChange={(e) => onSelectSize(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Undo & Redo */}
      <div className="flex items-center gap-1 pl-1.5 pr-1.5 border-l border-r border-slate-200">
        <button
          id="btn-action-undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            canUndo
              ? 'text-slate-700 hover:bg-slate-100 cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-5 h-5" />
        </button>

        <button
          id="btn-action-redo"
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            canRedo
              ? 'text-slate-700 hover:bg-slate-100 cursor-pointer'
              : 'text-slate-300 cursor-not-allowed'
          }`}
        >
          <Redo2 className="w-5 h-5" />
        </button>

        <button
          id="btn-action-clear"
          title={confirmClear ? 'Click again to confirm Clear Board' : 'Clear Board'}
          onClick={handleClearClick}
          className={`flex items-center justify-center px-2.5 h-10 rounded-xl transition-colors text-xs font-semibold ${
            confirmClear
              ? 'bg-red-600 text-white animate-pulse'
              : 'text-rose-600 hover:bg-rose-50'
          }`}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {confirmClear ? 'Confirm Clear?' : 'Clear'}
        </button>
      </div>

      {/* Background Selector */}
      <div className="relative">
        <button
          id="btn-background-toggle"
          title="Background Surface"
          onClick={() => {
            setShowBgPicker(!showBgPicker);
            setShowColorPicker(false);
            setShowSizePicker(false);
          }}
          className="flex items-center gap-1 px-2.5 h-10 rounded-xl hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors"
        >
          {backgroundMode === 'camera' && <Video className="w-4 h-4 text-indigo-600" />}
          {backgroundMode === 'image' && <ImageIcon className="w-4 h-4 text-emerald-600" />}
          {backgroundMode === 'blank' && <Square className="w-4 h-4 text-slate-600" />}
          <span className="capitalize">{backgroundMode}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {showBgPicker && (
          <div
            id="background-popover"
            className="absolute bottom-13 left-0 p-3 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col gap-2 w-56 z-50"
          >
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Surface Mode</div>
            <button
              id="btn-bg-camera"
              onClick={() => {
                onSelectBackgroundMode('camera');
                setShowBgPicker(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                backgroundMode === 'camera' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Live Webcam Feed</span>
            </button>

            <button
              id="btn-bg-image"
              onClick={() => {
                onSelectBackgroundMode('image');
                onOpenImageUpload();
                setShowBgPicker(false);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                backgroundMode === 'image' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Upload Local Image...</span>
            </button>

            <div className="pt-2 border-t border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Blank Presets
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                id="btn-bg-whiteboard"
                onClick={() => {
                  onSelectBackgroundMode('blank');
                  onSelectBlankPreset('whiteboard');
                  setShowBgPicker(false);
                }}
                className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-colors ${
                  backgroundMode === 'blank' && blankPreset === 'whiteboard'
                    ? 'bg-slate-100 border-slate-400 text-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Whiteboard
              </button>
              <button
                id="btn-bg-blackboard"
                onClick={() => {
                  onSelectBackgroundMode('blank');
                  onSelectBlankPreset('blackboard');
                  setShowBgPicker(false);
                }}
                className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-colors ${
                  backgroundMode === 'blank' && blankPreset === 'blackboard'
                    ? 'bg-slate-800 border-slate-900 text-white font-bold'
                    : 'bg-slate-700 border-slate-800 text-slate-100 hover:bg-slate-600'
                }`}
              >
                Blackboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Export, Calibration, Debug, Fullscreen */}
      <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200">
        <button
          id="btn-action-export"
          title="Save / Export PNG"
          onClick={onOpenExport}
          className="flex items-center gap-1 px-3 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Save PNG</span>
        </button>

        <button
          id="btn-calibration"
          title="Calibration & Gestures"
          onClick={onOpenCalibration}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Sliders className="w-5 h-5" />
        </button>

        <button
          id="btn-debug-toggle"
          title={isDebugOpen ? 'Hide Diagnostics' : 'Show Diagnostics (D)'}
          onClick={onToggleDebug}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
            isDebugOpen ? 'bg-amber-100 text-amber-800 font-semibold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {isDebugOpen ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>

        <button
          id="btn-fullscreen-toggle"
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (F)'}
          onClick={onToggleFullscreen}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>

        {onOpenPresentationWindow && (
          <button
            id="btn-open-presentation-window"
            title="Open Clean Presentation Window for Screen Sharing"
            onClick={onOpenPresentationWindow}
            className="flex items-center gap-1 px-2.5 h-10 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Present</span>
          </button>
        )}
      </div>
    </div>
  );
};
