import type { ReactNode } from 'react';
import { useT } from '../../i18n/useT.js';
import styles from './AuthLayout.module.css';

export interface AuthLayoutProps {
  title: string;
  hint?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Gemeinsamer Rahmen aller Anmeldeseiten.
 *
 * `h1` ist der Seitentitel, nicht der Markenname: ein Screenreader-Nutzer will
 * wissen, auf welcher Seite er ist, und „Ralia" steht auf jeder.
 */
export function AuthLayout({ title, hint, children, footer }: AuthLayoutProps): React.JSX.Element {
  const { t } = useT();

  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <div className={styles.logo}>Ralia</div>
          <div className={styles.kicker}>{t('authKicker')}</div>
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {hint !== undefined && <p className={styles.hint}>{hint}</p>}
          {children}
        </div>

        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
