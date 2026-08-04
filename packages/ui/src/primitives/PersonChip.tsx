import { personTokens, type PersonSlot } from '../person.js';
import styles from './PersonChip.module.css';

export interface PersonChipProps {
  slot: PersonSlot;
  active: boolean;
  label: string;
  onClick(): void;
}

export function PersonChip({ slot, active, label, onClick }: PersonChipProps): React.JSX.Element {
  const tokens = personTokens(slot);
  // Inline statt Klasse pro Slot: sonst muesste das Modul jede Kombination
  // aus vier Slots und zwei Zustaenden kennen. Die Werte bleiben Tokens.
  const style = active
    ? { borderColor: tokens.bar, background: tokens.bg, color: tokens.fg }
    : undefined;
  return (
    <button
      type="button"
      className={styles.personChip}
      aria-pressed={active}
      onClick={onClick}
      {...(style ? { style } : {})}
    >
      {label}
    </button>
  );
}
