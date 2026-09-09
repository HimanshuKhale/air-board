/**
 * SAAI AirBoard - Performance & Diagnostics Profiler
 */

export class PerformanceTracker {
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 60;

  recordRenderFrame(): number {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsTime;

    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    return this.currentFps;
  }

  getCurrentFps(): number {
    return this.currentFps;
  }

  reset(): void {
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 60;
  }
}
