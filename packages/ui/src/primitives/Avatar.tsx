import { personTokens, type PersonSlot } from '../person.js';
import styles from './Avatar.module.css';

export interface AvatarProps {
  initial: string;
  slot: PersonSlot;
  /** Vorlage: 30 in der Sidebar (Z. 74), 52 im Profil (Z. 446). */
  size?: number;
  shape?: 'circle' | 'rounded';
  /** Der zweite Avatar eines Paars: ueberlappt und traegt einen Rand. */
  overlap?: boolean;
}

export function Avatar({
  initial,
  slot,
  size = 30,
  shape = 'circle',
  overlap = false,
}: AvatarProps): React.JSX.Element {
  // Radius-Regel aus zwei Belegen der Vorlage: 30px/10 (Z. 285), 52px/18 (Z. 446).
  const radius = shape === 'circle' ? '50%' : `${Math.round(size / 3)}px`;
  return (
    <span
      className={`${styles.avatar} ${overlap ? styles.second : ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius,
        background: personTokens(slot).bar,
        fontSize: `${Math.max(11, Math.round(size * 0.38 * 10) / 10)}px`,
      }}
    >
      {initial}
    </span>
  );
}
