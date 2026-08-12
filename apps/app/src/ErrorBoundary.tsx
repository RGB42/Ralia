import { EmptyState } from '@ralia/ui';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';
import { useT } from './i18n/useT.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Einsetzbar fuer Tests; die App laedt wirklich neu (jsdom kann kein reload). */
  onReload?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function reloadPage(): void {
  globalThis.location.reload();
}

/**
 * Der Fallback ist eine eigene Funktionskomponente, weil `useT` in einer Klasse
 * nicht geht — und eine Fehlergrenze in React eine Klasse sein muss.
 */
function CrashScreen({
  error,
  onReload,
}: {
  error: Error;
  onReload: () => void;
}): React.JSX.Element {
  const { t } = useT();
  return (
    <div className={styles.crashed} role="alert">
      <EmptyState
        message={`${t('errorCrashed')} ${error.message}`}
        action={{ label: t('reloadApp'), onClick: onReload }}
      />
    </div>
  );
}

/**
 * Letztes Netz unter dem Router. Ohne sie hinterlaesst ein einzelner
 * Renderfehler eine weisse Seite ohne Weg zurueck — auf dem Handy bleibt dann
 * nur, den Tab zu schliessen.
 *
 * Die Meldung wird mit angezeigt, nicht verschluckt: bei einer App ohne
 * Fehler-Telemetrie ist der Bildschirm der einzige Fehlerbericht, den es gibt.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Ralia: unbehandelter Renderfehler', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <CrashScreen error={error} onReload={this.props.onReload ?? reloadPage} />;
  }
}
