import styles from './Fab.module.css';

export interface FabProps {
  label: string;
  onClick(): void;
}

export function Fab({ label, onClick }: FabProps): React.JSX.Element {
  return (
    <button type="button" className={styles.fab} aria-label={label} onClick={onClick}>
      <span aria-hidden="true">+</span>
    </button>
  );
}
