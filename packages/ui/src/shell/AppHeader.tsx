import type { ReactNode } from 'react';
import { IconButton } from '../primitives/IconButton.js';
import styles from './AppHeader.module.css';

export interface AppHeaderRange {
  onPrev(): void;
  onToday(): void;
  onNext(): void;
  prevLabel: string;
  todayLabel: string;
  nextLabel: string;
}

export interface AppHeaderProps {
  kicker: string;
  title: string;
  onBack?: () => void;
  backLabel?: string;
  range?: AppHeaderRange;
  /** Die Zeile unter dem Titel — Segment-Switch, Legende, Filter. */
  children?: ReactNode;
}

export function AppHeader({
  kicker,
  title,
  onBack,
  backLabel = 'Zurück',
  range,
  children,
}: AppHeaderProps): React.JSX.Element {
  return (
    <div className={styles.header}>
      <div className={styles.top}>
        {onBack ? (
          <IconButton label={backLabel} onClick={onBack}>
            ‹
          </IconButton>
        ) : null}
        <div className={styles.titles}>
          <div className={styles.kicker}>{kicker}</div>
          <h1 className={styles.title}>{title}</h1>
        </div>
        {range ? (
          <div className={styles.range}>
            <IconButton label={range.prevLabel} onClick={range.onPrev}>
              ‹
            </IconButton>
            <button type="button" className={styles.today} onClick={range.onToday}>
              {range.todayLabel}
            </button>
            <IconButton label={range.nextLabel} onClick={range.onNext}>
              ›
            </IconButton>
          </div>
        ) : null}
      </div>
      {children ? <div className={styles.extra}>{children}</div> : null}
    </div>
  );
}
