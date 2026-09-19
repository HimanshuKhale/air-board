export type TranscriptEvent = { type: 'interim' | 'final'; text: string };
/** Separate microphone lifecycle. It never requests video or runs in the render loop. */
export class SpeechController {
  listening = false;
  provider = 'unknown';
  onTranscript: (event: TranscriptEvent) => void = () => {};
  onStatus: (status: string) => void = () => {};
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer = 0;
  private generation = 0;
  private aborters = new Set<AbortController>();
  private queue = Promise.resolve();
  async start(): Promise<void> {
    if (this.listening) return;
    const generation = ++this.generation;
    this.onStatus('Checking speech service…');
    const health = await fetch('http://127.0.0.1:8787/api/health', { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error('Speech service is unavailable. Drawing still works.');
    const info = await health.json() as { provider?: string }; this.provider = info.provider || 'unknown';
    if (generation !== this.generation) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Microphone recording is unavailable in this browser.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (generation !== this.generation) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; return; }
    this.listening = true; this.onStatus(`Listening · ${this.provider} transcription`); this.record(generation);
  }
  private record(generation: number): void {
    if (!this.listening || !this.stream || generation !== this.generation) return;
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { this.stop(); this.onStatus('This browser cannot record WebM or Ogg audio.'); return; }
    const chunks: Blob[] = [], recorder = new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: 64000 });
    this.recorder = recorder;
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { this.stop(); this.onStatus('Microphone recording failed.'); };
    recorder.onstop = () => {
      clearTimeout(this.timer);
      if (!this.listening || generation !== this.generation) return;
      const blob = new Blob(chunks, { type: mime });
      if (blob.size >= 100) this.queue = this.queue.then(() => this.transcribe(blob, generation)).catch(error => { if (this.listening) this.onStatus(error instanceof Error ? error.message : 'Transcription failed.'); });
      this.record(generation);
    };
    recorder.start();
    this.timer = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
  }
  private async transcribe(blob: Blob, generation: number): Promise<void> {
    if (!this.listening || generation !== this.generation) return;
    const abort = new AbortController(); this.aborters.add(abort);
    try {
      this.onStatus('Transcribing…');
      const response = await fetch('http://127.0.0.1:8787/api/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob, signal: abort.signal });
      if (!response.ok || !response.body) throw new Error(`Speech service error (${response.status}). Drawing remains available.`);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const row = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          if (!row) continue;
          const event = JSON.parse(row) as TranscriptEvent | { type: 'error'; message: string };
          if (event.type === 'error') throw new Error(event.message);
          if (this.listening && generation === this.generation && ['interim', 'final'].includes(event.type) && typeof event.text === 'string') this.onTranscript(event);
        }
      }
      if (this.listening) this.onStatus(`Listening · ${this.provider} transcription`);
    } finally { this.aborters.delete(abort); }
  }
  stop(): void {
    this.listening = false; this.generation++; clearTimeout(this.timer);
    if (this.recorder?.state === 'recording') this.recorder.stop(); this.recorder = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    for (const abort of this.aborters) abort.abort(); this.aborters.clear();
    this.onStatus('Microphone off');
  }
}
