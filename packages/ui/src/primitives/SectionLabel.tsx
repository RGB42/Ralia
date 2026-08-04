import type { ReactNode } from 'react';
import styles from './labels.module.css';

export interface SectionLabelProps {
  children: ReactNode;
}

/** Vorlage Z. 363. */
export function SectionLabel({ children }: SectionLabelProps): React.JSX.Element {
  return <div className={styles.sectionLabel}>{children}</div>;
}
