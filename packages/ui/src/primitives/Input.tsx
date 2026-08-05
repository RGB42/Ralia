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
  /**
   * Feldname im Formular. Zusammen mit `autoComplete` das, woran ein
   * Passwortmanager erkennt, was hier hineingehoert.
   */
  name?: string;
  /**
   * `current-password`, `new-password`, `email`, `name` — die Werte, die
   * Browser und Passwortmanager verstehen. In einem Anmeldeformular ist das der
   * Unterschied zwischen einmal antippen und von Hand abtippen.
   */
  autoComplete?: string;
  /** Ueberlaesst die Pflichtpruefung dem Formular selbst. */
  required?: boolean;
  /**
   * Zugaenglicher Name, wenn es kein sichtbares `FieldLabel` gibt.
   *
   * Der Fall ist eine `ListRow`: dort *ist* der Zeilentitel die Beschriftung,
   * aber er steht als Text daneben und nicht als `<label for>`. Ohne diesen Wert
   * waere das Feld fuer einen Screenreader namenlos. Wo ein `FieldLabel` mit
   * `htmlFor` steht, gehoert hier nichts hin — zwei Namen sind schlechter als
   * einer.
   */
  ariaLabel?: string;
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
  name,
  autoComplete,
  required,
  ariaLabel,
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
      {...(name ? { name } : {})}
      {...(autoComplete ? { autoComplete } : {})}
      {...(required ? { required: true as const } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      {...(width ? { style: { width } } : {})}
    />
  );
}
