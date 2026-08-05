import styles from './Chip.module.css';

export interface ChipProps {
  active: boolean;
  label: string;
  onClick(): void;
}

export function Chip({ active, label, onClick }: ChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.active : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
