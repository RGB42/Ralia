import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  disabled?: boolean;
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
}: ToggleProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.track} ${checked ? styles.on : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
