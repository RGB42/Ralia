import styles from './fields.module.css';

export interface TextareaProps {
  id?: string;
  value: string;
  onChange(next: string): void;
  rows?: number;
  placeholder?: string;
}

export function Textarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
}: TextareaProps): React.JSX.Element {
  return (
    <textarea
      className={`${styles.field} ${styles.textarea}`}
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      {...(id ? { id } : {})}
      {...(placeholder ? { placeholder } : {})}
    />
  );
}
