import type { ReactNode } from 'react';
import styles from './ListRow.module.css';

export interface ListRowProps {
  title: string;
  hint?: string;
  /** Steuerelement am rechten Rand — Toggle, Wert, Chip. */
  children?: ReactNode;
  onClick?: () => void;
  /** Letzte Zeile einer Karte: keine Trennlinie. */
  last?: boolean;
}

export function ListRow({
  title,
  hint,
  children,
  onClick,
  last = false,
}: ListRowProps): React.JSX.Element {
  const body = (
    <>
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {hint ? <div className={styles.hint}>{hint}</div> : null}
      </div>
      {children}
    </>
  );

  // Ohne Handler ein div: ein Knopf, der nichts tut, ist fuer Tastaturnutzer
  // eine Falle — er faengt den Fokus ein und liefert keine Wirkung.
  if (!onClick) {
    return <div className={`${styles.row} ${last ? styles.last : ''}`}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={`${styles.row} ${styles.clickable} ${last ? styles.last : ''}`}
      onClick={onClick}
    >
      {body}
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </button>
  );
}
