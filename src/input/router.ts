import { BOARD, type Point } from '../core/types';
import { canvasToClient, clientToCanvas, inside } from '../core/coordinates';
import type { BoardChannel } from '../sync/channel';
import type { PinchPhase } from './pinch';
/** Mouse, touch and generic hand events share the same action protocol. */
export class InputRouter {
  private stroke: string | null = null;
  private source: 'mouse' | 'hand' | null = null;
  private handTarget: HTMLElement | null = null;
  private mouseDown = false;
  private previousMouse: Point | null = null;
  onPointer: (client: Point, held: boolean, hand: boolean) => void = () => {};
  onActivity: () => void = () => {};
  constructor(readonly canvas: HTMLCanvasElement, readonly bus: BoardChannel) {
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      this.end();
      this.mouseDown = true; this.previousMouse = null;
      canvas.setPointerCapture(event.pointerId);
      const client = { x: event.clientX, y: event.clientY };
      const point = clientToCanvas(client, canvas.getBoundingClientRect(), BOARD);
      this.begin(point, 'mouse'); this.previousMouse = point;
      this.onPointer(client, true, false); this.onActivity();
    });
    canvas.addEventListener('pointermove', event => {
      if (!event.isPrimary) return;
      const client = { x: event.clientX, y: event.clientY };
      this.onPointer(client, this.mouseDown, false);
      if (!this.mouseDown) return;
      const samples = event.getCoalescedEvents?.();
      for (const sample of samples?.length ? samples : [event]) {
        const point = clientToCanvas({ x: sample.clientX, y: sample.clientY }, canvas.getBoundingClientRect(), BOARD);
        if (!inside(point, BOARD)) { this.endStroke(); this.previousMouse = null; continue; }
        if (!this.stroke && !this.previousMouse) this.begin(point, 'mouse');
        else this.move(point);
        this.previousMouse = point;
      }
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
      this.mouseDown = false; this.previousMouse = null; if (this.source === 'mouse') this.endStroke();
      if (event instanceof PointerEvent) this.onPointer({ x: event.clientX, y: event.clientY }, false, false);
    });
    window.addEventListener('blur', () => this.end());
  }
  private begin(point: Point, source: 'mouse' | 'hand'): void {
    if (!inside(point, BOARD) || !this.bus.ready || this.bus.state.history.active) return;
    this.stroke = crypto.randomUUID(); this.source = source;
    this.bus.send({ type: 'begin', id: this.stroke, point, brush: this.bus.state.settings.brush });
  }
  private move(point: Point): void {
    if (this.stroke && inside(point, BOARD)) this.bus.send({ type: 'point', id: this.stroke, point });
  }
  private endStroke(): void {
    if (this.stroke) this.bus.send({ type: 'end', id: this.stroke });
    this.stroke = null; this.source = null;
  }
  cancelDrawing(): void { this.endStroke(); }
  endHand(): void {
    if (this.source === 'hand') this.endStroke();
    this.handTarget = null;
  }
  heartbeat(): void {
    if (this.mouseDown && this.stroke && this.previousMouse) this.move(this.previousMouse);
  }
  end(): void { this.endStroke(); this.handTarget = null; this.mouseDown = false; this.previousMouse = null; }
  hand(point: Point, phase: PinchPhase): void {
    if (this.mouseDown) return;
    const client = canvasToClient(point, this.canvas.getBoundingClientRect(), BOARD);
    const held = phase === 'pinchStart' || phase === 'pinchHold';
    this.onPointer(client, held, true);
    const elements = document.elementsFromPoint(client.x, client.y);
    const target = elements.map(element => element.closest<HTMLElement>('button,input,select,a,label')).find(Boolean) ?? null;
    const modal = document.querySelector('dialog[open]');
    if (phase === 'pinchEnd') { if (this.source === 'hand') this.endStroke(); this.handTarget = null; return; }
    if (phase === 'pinchStart') {
      this.onActivity();
      this.handTarget = target;
      if (target && !target.closest('[inert]') && !(target as HTMLButtonElement).disabled) {
        if (target instanceof HTMLInputElement && target.type === 'range') this.dragSlider(target, client);
        else target.click();
      } else if (!modal && elements.includes(this.canvas)) this.begin(point, 'hand');
    } else if (phase === 'pinchHold') {
      if (this.handTarget instanceof HTMLInputElement && this.handTarget.type === 'range') this.dragSlider(this.handTarget, client);
      if (this.source === 'hand') {
        if (!inside(point, BOARD) || target || modal || !elements.includes(this.canvas)) this.endStroke();
        else this.move(point);
      }
    }
  }
  private dragSlider(input: HTMLInputElement, point: Point): void {
    const rect = input.getBoundingClientRect();
    const min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
    const value = min + Math.min(1, Math.max(0, (point.x - rect.x) / rect.width)) * (max - min);
    input.value = String(Math.round(value / step) * step);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
