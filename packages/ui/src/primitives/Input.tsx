import styles from './fields.module.css';

export type InputType = 'text' | 'date' | 'time' | 'number' | 'email' | 'password';

export interface InputProps {
  id?: string;
  value: string;
  /** Gibt den Wert, nicht das Event — das haelt die Screens frei von DOM-Details. */
  onChange(next: string): void;
  type?: InputType;
  placeholder?: string;
  step?: string;
  width?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  /** Id einer Fehler- oder Hilfsmeldung, die das Feld beschreibt. */
  describedBy?: string;
  /** Setzt `aria-invalid`, damit Screenreader den Fehler ansagen. */
  invalid?: boolean;
}

const COMPACT: readonly InputType[] = ['date', 'time'];

export function Input({
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  step,
  width,
  inputMode,
  describedBy,
  invalid,
}: InputProps): React.JSX.Element {
  const classes = `${styles.field} ${COMPACT.includes(type) ? styles.compact : ''}`;
  return (
    <input
      className={classes}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...(id ? { id } : {})}
      {...(placeholder ? { placeholder } : {})}
      {...(step ? { step } : {})}
      {...(inputMode ? { inputMode } : {})}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      {...(invalid ? { 'aria-invalid': true as const } : {})}
      {...(width ? { style: { width } } : {})}
    />
  );
}
