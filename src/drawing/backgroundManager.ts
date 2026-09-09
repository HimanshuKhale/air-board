/**
 * SAAI AirBoard - Background Management System
 *
 * Supports Camera, Local Image, and Blank Board (Whiteboard, Blackboard, Custom).
 * Provides background rendering for live presentation and offline export compositing.
 */

import { BackgroundState } from '../types';

export const DEFAULT_BACKGROUND_STATE: BackgroundState = {
  mode: 'blank',
  camera: {
    mirror: true,
    opacity: 1.0,
    blur: 0,
    dim: 0,
    fit: 'cover',
  },
  image: {
    dataUrl: null,
    fileName: null,
    fit: 'contain',
    opacity: 1.0,
  },
  blank: {
    preset: 'whiteboard',
    color: '#ffffff',
    gridPattern: 'none',
  },
};

export class BackgroundManager {
  private state: BackgroundState;
  private loadedImageElement: HTMLImageElement | null = null;
  private changeListeners: Set<(state: BackgroundState) => void> = new Set();

  constructor(initialState?: Partial<BackgroundState>) {
    this.state = {
      mode: initialState?.mode ?? DEFAULT_BACKGROUND_STATE.mode,
      camera: { ...DEFAULT_BACKGROUND_STATE.camera, ...initialState?.camera },
      image: { ...DEFAULT_BACKGROUND_STATE.image, ...initialState?.image },
      blank: { ...DEFAULT_BACKGROUND_STATE.blank, ...initialState?.blank },
    };

    if (this.state.image.dataUrl) {
      this.loadImageFromUrl(this.state.image.dataUrl);
    }
  }

  getState(): BackgroundState {
    return JSON.parse(JSON.stringify(this.state));
  }

  setState(newState: Partial<BackgroundState>): void {
    if (newState.mode) this.state.mode = newState.mode;
    if (newState.camera) this.state.camera = { ...this.state.camera, ...newState.camera };
    if (newState.image) {
      this.state.image = { ...this.state.image, ...newState.image };
      if (newState.image.dataUrl && newState.image.dataUrl !== this.loadedImageElement?.src) {
        this.loadImageFromUrl(newState.image.dataUrl);
      }
    }
    if (newState.blank) this.state.blank = { ...this.state.blank, ...newState.blank };

    this.notify();
  }

  setMode(mode: BackgroundState['mode']): void {
    this.state.mode = mode;
    this.notify();
  }

  async loadLocalImage(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          this.state.mode = 'image';
          this.state.image.dataUrl = dataUrl;
          this.state.image.fileName = file.name;
          this.loadImageFromUrl(dataUrl).then(() => {
            this.notify();
            resolve(true);
          });
        } else {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsDataURL(file);
    });
  }

  private loadImageFromUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.loadedImageElement = img;
        resolve(img);
      };
      img.src = dataUrl;
    });
  }

  getLoadedImage(): HTMLImageElement | null {
    return this.loadedImageElement;
  }

  /**
   * Renders the background onto an export canvas.
   * Handles video frame capture with mirror transform, local image fitting, or blank color/grid.
   */
  renderToCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    videoElement?: HTMLVideoElement | null
  ): void {
    ctx.save();

    if (this.state.mode === 'camera') {
      if (videoElement && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.save();
        if (this.state.camera.mirror) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }

        // Draw camera frame
        const vw = videoElement.videoWidth || 1280;
        const vh = videoElement.videoHeight || 720;
        const targetAspect = width / height;
        const videoAspect = vw / vh;

        let sx = 0, sy = 0, sw = vw, sh = vh;
        if (this.state.camera.fit === 'cover') {
          if (videoAspect > targetAspect) {
            sw = vh * targetAspect;
            sx = (vw - sw) / 2;
          } else {
            sh = vw / targetAspect;
            sy = (vh - sh) / 2;
          }
        }

        ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, width, height);

        if (this.state.camera.dim > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${this.state.camera.dim})`;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      } else {
        // Fallback dark camera background
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
      }
    } else if (this.state.mode === 'image' && this.loadedImageElement) {
      const img = this.loadedImageElement;
      const fit = this.state.image.fit;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      if (fit === 'stretch') {
        ctx.drawImage(img, 0, 0, width, height);
      } else if (fit === 'contain') {
        const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
        const nw = img.naturalWidth * scale;
        const nh = img.naturalHeight * scale;
        const dx = (width - nw) / 2;
        const dy = (height - nh) / 2;
        ctx.drawImage(img, dx, dy, nw, nh);
      } else {
        // cover
        const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
        const nw = img.naturalWidth * scale;
        const nh = img.naturalHeight * scale;
        const dx = (width - nw) / 2;
        const dy = (height - nh) / 2;
        ctx.drawImage(img, dx, dy, nw, nh);
      }
    } else {
      // Blank Board
      let bgColor = this.state.blank.color;
      if (this.state.blank.preset === 'whiteboard') {
        bgColor = '#ffffff';
      } else if (this.state.blank.preset === 'blackboard') {
        bgColor = '#1a2332';
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // Render grid if configured
      if (this.state.blank.gridPattern && this.state.blank.gridPattern !== 'none') {
        this.renderGrid(ctx, width, height, this.state.blank.gridPattern, bgColor);
      }
    }

    ctx.restore();
  }

  private renderGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    pattern: 'dots' | 'grid' | 'lines',
    bgColor: string
  ): void {
    const isDark = bgColor.toLowerCase() === '#1a2332' || bgColor.toLowerCase().startsWith('#1') || bgColor.toLowerCase().startsWith('#2');
    const strokeColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    const step = 40;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = 1;

    if (pattern === 'grid') {
      ctx.beginPath();
      for (let x = step; x < width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = step; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (pattern === 'lines') {
      ctx.beginPath();
      for (let y = step; y < height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    } else if (pattern === 'dots') {
      for (let x = step; x < width; x += step) {
        for (let y = step; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  onChange(listener: (state: BackgroundState) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notify(): void {
    const copy = this.getState();
    this.changeListeners.forEach((fn) => fn(copy));
  }
}
