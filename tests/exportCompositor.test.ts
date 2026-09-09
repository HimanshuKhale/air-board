import { describe, it, expect } from 'vitest';
import { formatExportTimestamp } from '../src/drawing/exportCompositor';

describe('ExportCompositor', () => {
  it('generates filename in exact requested pattern saai-airboard-YYYY-MM-DD-HHMMSS.png', () => {
    const fixedDate = new Date(2026, 8, 9, 14, 30, 45); // Sept 9 2026 14:30:45
    const filename = formatExportTimestamp(fixedDate);
    expect(filename).toBe('saai-airboard-2026-09-09-143045.png');
  });

  it('pads single-digit months, days, hours, minutes, and seconds with zero', () => {
    const earlyDate = new Date(2026, 0, 5, 4, 3, 2); // Jan 5 2026 04:03:02
    const filename = formatExportTimestamp(earlyDate);
    expect(filename).toBe('saai-airboard-2026-01-05-040302.png');
  });
});
