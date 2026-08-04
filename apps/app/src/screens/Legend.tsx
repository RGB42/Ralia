import { personTokens, type PersonSlot } from '@ralia/ui';
import styles from './screen.module.css';

export interface LegendEntry {
  slot: PersonSlot;
  label: string;
}

/** Die Personenlegende der Kalender-Kopfzeile (Vorlage Z. 135–139). */
export function Legend({ entries }: { entries: readonly LegendEntry[] }): React.JSX.Element {
  return (
    <div className={styles.legend}>
      {entries.map((entry) => (
        <span key={entry.slot} className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ background: personTokens(entry.slot).bar }}
            aria-hidden="true"
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}
