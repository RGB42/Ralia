import type { KeyboardEvent } from 'react';
import styles from './SegmentSwitch.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentSwitchProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(next: T): void;
  /** Name der Gruppe fuer Screenreader — die Vorlage hat keinen. */
  label: string;
}

export function SegmentSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentSwitchProps<T>): React.JSX.Element {
  const move = (delta: number) => {
    const current = options.findIndex((o) => o.value === value);
    const next = options[(current + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <div className={styles.group} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            // Nur der aktive Eintrag ist tabbar: Tab springt ueber die Gruppe,
            // die Pfeiltasten bewegen sich darin.
            tabIndex={active ? 0 : -1}
            className={`${styles.segment} ${active ? styles.active : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
