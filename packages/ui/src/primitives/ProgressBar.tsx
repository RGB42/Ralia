import styles from './ProgressBar.module.css';

export interface ProgressSegment {
  widthPct: number;
  /** Token-Referenz, kein Literal — sonst reagiert der Balken nicht auf das Theme. */
  color: string;
}

export interface ProgressBarProps {
  /** Vorlage: 6 in Todo-Karten, 7 bei Kategorien, 9 im Budget. */
  height?: number;
  segments: readonly ProgressSegment[];
  label: string;
}

export function ProgressBar({ height = 7, segments, label }: ProgressBarProps): React.JSX.Element {
  const total = segments.reduce((sum, segment) => sum + segment.widthPct, 0);
  const value = Math.round(Math.min(100, Math.max(0, total)));
  return (
    <div
      className={styles.track}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      {segments.map((segment, index) => (
        <div
          // Segmente haben keine eigene Identitaet; die Reihenfolge ist ihre Identitaet.
          key={index}
          className={styles.segment}
          style={{
            width: `${Math.max(0, Math.min(100, segment.widthPct))}%`,
            background: segment.color,
          }}
        />
      ))}
    </div>
  );
}
