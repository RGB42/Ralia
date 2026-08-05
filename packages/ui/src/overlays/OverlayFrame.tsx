import { useEffect, useId } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { IconButton } from '../primitives/IconButton.js';
import { SheetHandle } from '../primitives/SheetHandle.js';
import styles from './OverlayFrame.module.css';
import { useFocusTrap } from './use-focus-trap.js';
import { useScrollLock } from './use-scroll-lock.js';

export interface OverlayFrameProps {
  open: boolean;
  onClose(): void;
  title: string;
  kicker?: string;
  placement: 'bottom' | 'center';
  /** Vorlage: 78 % beim Tages-Sheet, 88 % bei „Neu", 90 % sonst, `none` beim Item-Sheet. */
  maxHeight?: string;
  /** ConfirmDialog unterdrueckt den Schliesser, damit Abbrechen den Startfokus bekommt. */
  dismissible?: boolean;
  /** Griff am oberen Rand — nur bei Sheets, nicht bei zentrierten Dialogen. */
  handle?: boolean;
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Die gemeinsame Mechanik von BottomSheet und Modal: Fokus-Falle, Scroll-Lock,
 * Escape, Backdrop-Klick, ARIA. Beide brauchen dieselben acht Regeln — sie
 * zweimal zu schreiben hiesze, sie zweimal zu pflegen.
 */
export function OverlayFrame({
  open,
  onClose,
  title,
  kicker,
  placement,
  maxHeight = '90%',
  dismissible = true,
  handle = placement === 'bottom',
  closeLabel = 'Schließen',
  children,
}: OverlayFrameProps): React.JSX.Element | null {
  const titleId = useId();
  const panelRef = useFocusTrap(open);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Nur der Backdrop selbst schlieszt; ein Klick, der aus dem Panel nach oben
  // blubbert, hat currentTarget == Backdrop, aber target == Panel-Kind.
  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const bottom = placement === 'bottom';

  return (
    <div
      className={`${styles.backdrop} ${bottom ? styles.bottom : styles.center}`}
      data-testid="sheet-backdrop"
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${bottom ? styles.panelBottom : styles.panelCenter}`}
        style={maxHeight === 'none' ? undefined : { maxHeight }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {handle ? <SheetHandle /> : null}
        <div className={styles.head}>
          <div className={styles.headText}>
            {kicker ? <div className={styles.kicker}>{kicker}</div> : null}
            <div
              id={titleId}
              className={`${styles.title} ${kicker ? styles.titleLarge : styles.titlePlain}`}
            >
              {title}
            </div>
          </div>
          {dismissible ? (
            <IconButton label={closeLabel} onClick={onClose} size={32}>
              ✕
            </IconButton>
          ) : null}
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
