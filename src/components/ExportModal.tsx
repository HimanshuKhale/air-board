/**
 * SAAI AirBoard - Clean Export PNG Modal
 *
 * Composites high-resolution background + drawing or exports transparent drawing only.
 * Guaranteed to exclude all cursors, toolbars, and diagnostics.
 */

import React, { useState } from 'react';
import { Download, Layers, Image as ImageIcon, X, Check } from 'lucide-react';
import { ExportCompositor, formatExportTimestamp } from '../drawing/exportCompositor';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportCompositor: ExportCompositor | null;
  videoElement: HTMLVideoElement | null;
  currentBackgroundMode: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  exportCompositor,
  videoElement,
  currentBackgroundMode,
}) => {
  const [includeBackground, setIncludeBackground] = useState(true);
  const [fileName, setFileName] = useState(formatExportTimestamp());
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!exportCompositor) return;
    setIsExporting(true);
    try {
      await exportCompositor.exportImage(
        {
          includeBackground,
          fileName: fileName.trim() || formatExportTimestamp(),
        },
        videoElement
      );
      setExportedSuccess(true);
      setTimeout(() => {
        setExportedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      id="export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        id="export-modal-content"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Export Presentation Board</h2>
              <p className="text-xs text-slate-500">Save your board as a high-resolution PNG</p>
            </div>
          </div>
          <button
            id="btn-close-export"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Export Mode Selection */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Export Format</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-export-composite"
                type="button"
                onClick={() => setIncludeBackground(true)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  includeBackground
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 text-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Layers className={`w-4 h-4 ${includeBackground ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Full Presentation</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Background ({currentBackgroundMode}) + Ink Drawings
                </p>
              </button>

              <button
                id="btn-export-transparent"
                type="button"
                onClick={() => setIncludeBackground(false)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  !includeBackground
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 text-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon className={`w-4 h-4 ${!includeBackground ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Drawing Only</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Transparent PNG with isolated strokes
                </p>
              </button>
            </div>
          </div>

          {/* Filename Input */}
          <div className="space-y-1.5">
            <label htmlFor="input-export-filename" className="text-xs font-semibold text-slate-700">
              Filename
            </label>
            <input
              id="input-export-filename"
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
            />
          </div>

          {/* Cleanliness Note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Pristine Output Guarantee:</p>
            <p>Toolbars, fingertip cursors, FPS counters, and calibration overlays are completely excluded.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            id="btn-cancel-export"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-export"
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all ${
              exportedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {exportedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Compositing...' : 'Download Image'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
