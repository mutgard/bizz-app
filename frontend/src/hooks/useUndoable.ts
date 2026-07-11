import { createElement, useCallback, useRef, useState } from 'react';
import { T } from '../tokens';
import { t } from '../config';

export interface UndoableCore {
  /** Runs `action` immediately, then opens the undo window. */
  fire: () => Promise<void>;
  /** Runs `undo` if called while the window is still open; no-op otherwise. */
  undoNow: () => Promise<void>;
  /** Whether the undo window is currently open. */
  pending: () => boolean;
}

/**
 * Framework-free "optimistic action with an undo window" primitive.
 *
 * `fire()` performs `action` right away (the API change is already applied,
 * so the app can safely close mid-window) and opens a `ms`-long grace period.
 * Calling `undoNow()` inside that window runs `undo`; after it elapses the
 * action is considered committed and `undoNow()` becomes a no-op.
 */
export function makeUndoable(
  action: () => Promise<void>,
  undo: () => Promise<void>,
  ms = 10000,
): UndoableCore {
  let open = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const closeWindow = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    open = false;
  };

  return {
    async fire() {
      await action();
      open = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(closeWindow, ms);
    },
    async undoNow() {
      if (!open) return;
      closeWindow();
      await undo();
    },
    pending: () => open,
  };
}

export interface Undoable {
  /** Fires the action and opens the undo window (re-renders while pending). */
  fire: () => Promise<void>;
  /** Undoes the action if the window is still open. */
  undoNow: () => Promise<void>;
  /** Reactive mirror of the core's pending state. */
  pending: boolean;
}

/**
 * Thin React wrapper around {@link makeUndoable}: same semantics, but mirrors
 * `pending` into component state so consumers re-render when the window
 * opens/closes. `action`/`undo` are read through refs so the latest closures
 * are always used, even though the underlying core is created once.
 */
export function useUndoable(
  action: () => Promise<void>,
  undo: () => Promise<void>,
  ms = 10000,
): Undoable {
  const actionRef = useRef(action);
  const undoRef = useRef(undo);
  actionRef.current = action;
  undoRef.current = undo;

  const [pending, setPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coreRef = useRef<UndoableCore | null>(null);
  if (!coreRef.current) {
    coreRef.current = makeUndoable(
      () => actionRef.current(),
      () => undoRef.current(),
      ms,
    );
  }

  const fire = useCallback(async () => {
    await coreRef.current!.fire();
    setPending(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPending(false);
    }, ms);
  }, [ms]);

  const undoNow = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await coreRef.current!.undoNow();
    setPending(false);
  }, []);

  return { fire, undoNow, pending };
}

/**
 * Fixed-position pill shown while an undoable action is pending, e.g.
 * `<UndoToast pending={pending} onUndo={undoNow} />`. Not JSX (this module
 * keeps the `.ts` extension) — built with `createElement` directly.
 */
export function UndoToast({ pending, onUndo, label }: {
  pending: boolean;
  onUndo: () => void;
  label?: string;
}) {
  if (!pending) return null;
  return createElement(
    'div',
    {
      style: {
        position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 60,
        background: T.ink, color: T.paper,
        padding: '10px 10px 10px 16px', borderRadius: 999,
        fontFamily: T.mono, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      },
    },
    createElement('span', null, label ?? t('common.done')),
    createElement(
      'button',
      {
        onClick: onUndo,
        style: {
          background: 'transparent', border: `1px solid ${T.paper}66`, borderRadius: 999,
          color: T.gold, fontFamily: T.mono, fontSize: 10, letterSpacing: 0.6,
          textTransform: 'uppercase', padding: '5px 12px', cursor: 'pointer',
        },
      },
      t('common.undo'),
    ),
  );
}
