import type { ReactNode } from 'react';
import styles from './labels.module.css';

export interface FieldLabelProps {
  htmlFor?: string;
  children: ReactNode;
}

/** Vorlage Z. 751. */
export function FieldLabel({ htmlFor, children }: FieldLabelProps): React.JSX.Element {
  return (
    <label className={styles.fieldLabel} {...(htmlFor ? { htmlFor } : {})}>
      {children}
    </label>
  );
}
