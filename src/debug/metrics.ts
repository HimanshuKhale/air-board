export class RateCounter {
  private samples: number[] = [];
  tick(now = performance.now()): void { this.samples.push(now); this.samples = this.samples.filter(t => now - t < 1000); }
  get(now = performance.now()): number { return this.samples.filter(t => now - t < 1000).length; }
}
