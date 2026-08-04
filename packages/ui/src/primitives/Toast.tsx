import styles from './Toast.module.css';

export type ToastTone = 'info' | 'ok' | 'danger';

export interface ToastProps {
  message: string;
  tone: ToastTone;
  onClose(): void;
  /** Beschriftung des Schliessers — kommt aus dem i18n-Katalog des Aufrufers. */
  closeLabel: string;
}

export function Toast({ message, tone, onClose, closeLabel }: ToastProps): React.JSX.Element {
  return (
    <div className={styles.host}>
      {/*
       * status + polite, nicht alert: eine Speicherbestaetigung darf den
       * Screenreader nicht mitten im Satz unterbrechen.
       */}
      <div className={`${styles.toast} ${styles[tone]}`} role="status" aria-live="polite">
        <span className={styles.message}>{message}</span>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
