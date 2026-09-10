export class CameraManager {
  stream: MediaStream | null = null;
  private generation = 0;
  constructor(readonly video: HTMLVideoElement) {}
  async list(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices) throw new Error('Open this app on localhost in Chrome or Edge to use the camera.');
    return (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
  }
  async start(deviceId?: string): Promise<void> {
    this.stop();
    const generation = this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    });
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream; this.video.srcObject = stream;
    await this.video.play();
  }
  stop(): void {
    this.generation++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null; this.video.srcObject = null;
  }
}
export function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access using the address-bar camera icon, then try again.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'The selected camera is unavailable. Select another camera and try again.';
    if (error.name === 'NotReadableError') return 'The camera is busy or unavailable. Close other camera apps and try again.';
  }
  return error instanceof Error ? error.message : String(error);
}
