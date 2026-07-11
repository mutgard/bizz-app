import { describe, it, expect, vi } from 'vitest';
import { makeUndoable } from '../useUndoable';

describe('makeUndoable core', () => {
  it('runs action immediately and allows undo within window', async () => {
    vi.useFakeTimers();
    const action = vi.fn().mockResolvedValue(undefined);
    const undo = vi.fn().mockResolvedValue(undefined);
    const u = makeUndoable(action, undo, 10000);
    await u.fire();
    expect(action).toHaveBeenCalledOnce();
    expect(u.pending()).toBe(true);
    await u.undoNow();
    expect(undo).toHaveBeenCalledOnce();
    expect(u.pending()).toBe(false);
    vi.useRealTimers();
  });
  it('closes the window after the timeout', async () => {
    vi.useFakeTimers();
    const u = makeUndoable(async () => {}, async () => {}, 10000);
    await u.fire();
    vi.advanceTimersByTime(10001);
    expect(u.pending()).toBe(false);
    vi.useRealTimers();
  });
});
