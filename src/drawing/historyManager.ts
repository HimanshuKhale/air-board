/**
 * SAAI AirBoard - Stroke History & Undo/Redo Engine
 *
 * Maintains an efficient, non-destructive stroke action stack.
 * Supports undo, redo, and clear with history persistence.
 */

import { Stroke } from '../types';

export class HistoryManager {
  private undoStack: Stroke[] = [];
  private redoStack: Stroke[] = [];
  private maxHistory: number;
  private changeListeners: Set<() => void> = new Set();

  constructor(maxHistory = 60) {
    this.maxHistory = maxHistory;
  }

  addStroke(stroke: Stroke): void {
    if (stroke.points.length === 0) return;
    this.undoStack.push(stroke);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Clear redo stack on new user action
    this.redoStack = [];
    this.notify();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): Stroke | null {
    if (this.undoStack.length === 0) return null;
    const stroke = this.undoStack.pop()!;
    this.redoStack.push(stroke);
    this.notify();
    return stroke;
  }

  redo(): Stroke | null {
    if (this.redoStack.length === 0) return null;
    const stroke = this.redoStack.pop()!;
    this.undoStack.push(stroke);
    this.notify();
    return stroke;
  }

  clear(): void {
    if (this.undoStack.length === 0) return;
    // Push an empty/cleared checkpoint or archive
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  getStrokes(): Stroke[] {
    return [...this.undoStack];
  }

  setStrokes(strokes: Stroke[]): void {
    this.undoStack = [...strokes];
    this.redoStack = [];
    this.notify();
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notify(): void {
    this.changeListeners.forEach((fn) => fn());
  }
}
