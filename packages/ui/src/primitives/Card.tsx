import type { ReactNode } from 'react';
import styles from './Card.module.css';

export type CardTone = 'surface' | 'brand' | 'warn';

export interface CardProps {
  children: ReactNode;
  padding?: string;
  tone?: CardTone;
  /** Kein Innenpolster: fuer Karten aus Zeilen mit eigenen Trennlinien. */
  flush?: boolean;
}

export function Card({
  children,
  padding,
  tone = 'surface',
  flush = false,
}: CardProps): React.JSX.Element {
  const classes = [styles.card, styles[tone], flush ? styles.flush : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...(padding ? { style: { padding } } : {})}>
      {children}
    </div>
  );
}
