import { EmptyState, Skeleton, useToast } from '@ralia/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n/useT.js';
import styles from './BootGate.module.css';
import { runBoot, type BootState } from './bootstrap.js';

/** Platzhalter in der Form der spaeteren Inhalte — kein Spinner, kein Layoutsprung. */
function BootSkeleton(): React.JSX.Element {
  return (
    <div className={styles.pending}>
      <Skeleton height={22} width="45%" />
      <div className={styles.row}>
        <Skeleton height={34} width="30%" radius={11} />
        <Skeleton height={34} width="30%" radius={11} />
      </div>
      <Skeleton height={220} radius={20} />
      <Skeleton height={64} radius={20} />
      <Skeleton height={64} radius={20} />
    </div>
  );
}

export interface BootGateProps {
  children: ReactNode;
  /** Einsetzbar fuer Tests; die App nimmt den echten Boot. */
  boot?: () => Promise<BootState>;
}

export function BootGate({ children, boot = runBoot }: BootGateProps): React.JSX.Element {
  const [state, setState] = useState<BootState>({ phase: 'pending' });
  const [attempt, setAttempt] = useState(0);
  const { t } = useT();
  const { show } = useToast();
  /**
   * Der Boot darf genau einmal je Versuch laufen — zweimal hiesze, dass die
   * zweite Runde in eine halbe erste hineinmigriert.
   *
   * Deshalb liegt hier die laufende Zusage, nicht bloss ein „schon gestartet"-
   * Merker: StrictMode fuehrt jeden Effekt doppelt aus, und ein reiner Merker
   * wuerde vom Probelauf gesetzt, dessen Aufraeumen das Ergebnis danach
   * verwirft — der echte Lauf kaeme nie an. So haengt sich der zweite
   * Effektlauf an dieselbe Zusage und traegt sein eigenes `active`.
   */
  const inflight = useRef<{ attempt: number; promise: Promise<BootState> } | null>(null);
  const reported = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    if (!inflight.current || inflight.current.attempt !== attempt) {
      inflight.current = { attempt, promise: boot() };
    }
    void inflight.current.promise.then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, [attempt, boot]);

  // Warnungen als Toast, jede genau einmal — auch ueber ein Re-Render hinweg.
  useEffect(() => {
    if (state.phase !== 'ready') return;
    for (const warning of state.warnings) {
      if (reported.current.has(warning)) continue;
      reported.current.add(warning);
      show(warning, 'info');
    }
  }, [state, show]);

  const retry = useCallback(() => {
    setState({ phase: 'pending' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.phase === 'pending') return <BootSkeleton />;

  if (state.phase === 'failed') {
    return (
      <div className={styles.failed}>
        <EmptyState
          message={`${t('bootFailed')} ${state.error.message}`}
          action={{ label: t('retry'), onClick: retry }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
