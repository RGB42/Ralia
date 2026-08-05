import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  disabled?: boolean;
  /** `sm` ist die schmalere Bahn der Sync-Kalenderliste (Vorlage Z. 611). */
  size?: 'md' | 'sm';
}

/**
 * `<button role="switch">`: die Leertaste loest bei einem Knopf von sich aus
 * `click` aus — eigener Tastaturcode ist unnoetig.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: ToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={[styles.track, size === 'sm' ? styles.small : null, checked ? styles.on : null]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
