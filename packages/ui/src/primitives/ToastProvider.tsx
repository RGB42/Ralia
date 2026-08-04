import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Toast, type ToastTone } from './Toast.js';

export const TOAST_DURATION_MS = 4000;

export interface ToastContextValue {
  show(message: string, tone?: ToastTone): void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastState {
  message: string;
  tone: ToastTone;
  /** Zaehler statt Zufalls-Id: eine neue Meldung mit gleichem Text muss neu animieren. */
  seq: number;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Beschriftung des Schliessers. Standard deutsch; die App uebergibt den Katalogwert. */
  closeLabel?: string;
}

export function ToastProvider({
  children,
  closeLabel = 'Meldung schließen',
}: ToastProviderProps): React.JSX.Element {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  // Genau ein Toast gleichzeitig: ein neuer ersetzt den alten und setzt die Standzeit zurueck.
  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      clearTimer();
      seq.current += 1;
      setToast({ message, tone, seq: seq.current });
      timer.current = setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, TOAST_DURATION_MS);
    },
    [clearTimer],
  );

  // Beim Unmount darf kein Timer weiterlaufen und in einen toten Baum schreiben.
  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Toast
          key={toast.seq}
          message={toast.message}
          tone={toast.tone}
          onClose={hide}
          closeLabel={closeLabel}
        />
      ) : null}
    </ToastContext.Provider>
  );
}
