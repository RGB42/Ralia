import { Button } from '../primitives/Button.js';
import styles from './ConfirmDialog.module.css';
import { Modal } from './Modal.js';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
  return (
    // dismissible={false}: der Schliesser waere sonst das erste fokussierbare
    // Element, und die Fokus-Falle wuerde ihn statt Abbrechen anspringen.
    <Modal open={open} onClose={onCancel} title={title} dismissible={false}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        {/*
         * Abbrechen steht im DOM vor Bestaetigen. Der Startfokus liegt damit
         * auf dem harmlosen Weg, nicht auf der zerstoerenden Handlung.
         */}
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
