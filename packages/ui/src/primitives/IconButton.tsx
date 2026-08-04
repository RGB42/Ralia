import type { ReactNode } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  /** Wird `aria-label` — der Inhalt ist ein Zeichen und taugt nicht als Name. */
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** 34 in Kopfzeilen (Vorlage Z. 119–121), 32 als Sheet-Schliesser (Z. 719). */
  size?: 32 | 34;
}

export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  size = 34,
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.iconButton} ${size === 32 ? styles.size32 : styles.size34}`}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
