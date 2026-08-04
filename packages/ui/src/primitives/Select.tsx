import styles from './fields.module.css';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  id?: string;
  value: T;
  onChange(next: T): void;
  options: readonly SelectOption<T>[];
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
}: SelectProps<T>): React.JSX.Element {
  return (
    <select
      className={`${styles.field} ${styles.select}`}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      {...(id ? { id } : {})}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
