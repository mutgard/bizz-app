import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { T } from '../tokens';
import { t } from '../config';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation pattern for irreversible actions (deliver, delete, collect
 * payment…) — see the Fitxa sheet in docs/design/proposal-v1.html. Renders as
 * a bottom sheet on mobile, a centered dialog on desktop.
 *
 * Note on click semantics: the Confirm button is a plain button (only calls
 * `onConfirm`) so confirming never also triggers Radix's built-in
 * dialog-close event; Cancel is a real `AlertDialog.Cancel`, whose close
 * event is what drives `onCancel` (also fired for Escape-key dismissal).
 * Both callbacks are expected to flip the caller's `open` state to false.
 */
export function ConfirmSheet({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const mobile = useIsMobile();

  const btnBase = {
    fontFamily: T.sans, fontWeight: 600, fontSize: 13, letterSpacing: 0.2,
    borderRadius: 12, padding: 15, textAlign: 'center' as const, cursor: 'pointer',
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay style={{
          position: 'fixed', inset: 0, background: 'rgba(42,31,20,0.45)', zIndex: 50,
        }} />
        <AlertDialog.Content
          style={mobile ? {
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 51,
            background: T.sheet, borderRadius: '20px 20px 0 0',
            padding: '22px 20px calc(26px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -12px 40px rgba(42,31,20,0.35)',
            outline: 'none',
          } : {
            position: 'fixed', left: '50%', top: '50%', zIndex: 51,
            transform: 'translate(-50%, -50%)',
            background: T.sheet, border: `1px solid ${T.hairline}`,
            borderRadius: 8, padding: '26px 28px', width: '100%', maxWidth: 400,
            boxShadow: '0 24px 60px rgba(42,31,20,0.25)',
            outline: 'none',
          }}
        >
          {mobile && (
            <div style={{ width: 40, height: 4, borderRadius: 4, background: T.hairline, margin: '0 auto 16px' }} />
          )}
          <AlertDialog.Title style={{
            fontFamily: T.serif, fontSize: 19, fontWeight: 600, lineHeight: 1.25,
            margin: '0 0 6px', color: T.ink,
          }}>
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description style={{
            margin: '0 0 18px', color: T.ink2, fontSize: 13.5, lineHeight: 1.5,
          }}>
            {body}
          </AlertDialog.Description>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={onConfirm}
              style={{ ...btnBase, background: T.accent, color: '#fff', border: 'none' }}
            >
              {confirmLabel}
            </button>
            <AlertDialog.Cancel
              style={{ ...btnBase, background: 'transparent', border: `1px solid ${T.hairline}`, color: T.ink2 }}
            >
              {cancelLabel ?? t('common.cancel')}
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
