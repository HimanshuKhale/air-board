import { describe, it, expect, vi } from 'vitest';
import { HistoryManager } from '../src/drawing/historyManager';
import { Stroke } from '../src/types';

function createMockStroke(id: string, tool: 'pen' | 'highlighter' | 'eraser' = 'pen'): Stroke {
  return {
    id,
    tool,
    color: '#0f172a',
    size: 5,
    opacity: 1,
    points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
    timestamp: Date.now(),
  };
}

describe('HistoryManager', () => {
  it('correctly tracks undo and redo capabilities', () => {
    const manager = new HistoryManager(10);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    manager.addStroke(createMockStroke('stroke-1'));
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    expect(manager.getStrokes().length).toBe(1);

    manager.addStroke(createMockStroke('stroke-2'));
    expect(manager.getStrokes().length).toBe(2);

    // Undo stroke 2
    const undone = manager.undo();
    expect(undone?.id).toBe('stroke-2');
    expect(manager.getStrokes().length).toBe(1);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(true);

    // Redo stroke 2
    const redone = manager.redo();
    expect(redone?.id).toBe('stroke-2');
    expect(manager.getStrokes().length).toBe(2);
    expect(manager.canRedo()).toBe(false);
  });

  it('clears the redo stack when a new stroke is drawn after an undo', () => {
    const manager = new HistoryManager(10);
    manager.addStroke(createMockStroke('stroke-1'));
    manager.addStroke(createMockStroke('stroke-2'));

    manager.undo(); // stroke-2 in redo stack
    expect(manager.canRedo()).toBe(true);

    manager.addStroke(createMockStroke('stroke-3'));
    // Redo stack must now be empty
    expect(manager.canRedo()).toBe(false);
    expect(manager.getStrokes().map((s) => s.id)).toEqual(['stroke-1', 'stroke-3']);
  });

  it('notifies subscribers on any history mutation', () => {
    const manager = new HistoryManager(10);
    const listener = vi.fn();
    const unsub = manager.onChange(listener);

    manager.addStroke(createMockStroke('stroke-1'));
    expect(listener).toHaveBeenCalledTimes(1);

    manager.undo();
    expect(listener).toHaveBeenCalledTimes(2);

    manager.redo();
    expect(listener).toHaveBeenCalledTimes(3);

    manager.clear();
    expect(listener).toHaveBeenCalledTimes(4);

    unsub();
    manager.addStroke(createMockStroke('stroke-2'));
    expect(listener).toHaveBeenCalledTimes(4); // No more notifications after unsub
  });

  it('respects maximum history stack depth', () => {
    const manager = new HistoryManager(3);
    manager.addStroke(createMockStroke('stroke-1'));
    manager.addStroke(createMockStroke('stroke-2'));
    manager.addStroke(createMockStroke('stroke-3'));
    manager.addStroke(createMockStroke('stroke-4'));

    expect(manager.getStrokes().length).toBe(3);
    expect(manager.getStrokes().map((s) => s.id)).toEqual(['stroke-2', 'stroke-3', 'stroke-4']);
  });
});
