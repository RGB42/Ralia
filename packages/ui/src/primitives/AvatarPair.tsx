import type { PersonSlot } from '../person.js';
import { Avatar } from './Avatar.js';
import styles from './Avatar.module.css';

export interface AvatarPairPerson {
  initial: string;
  slot: PersonSlot;
}

export interface AvatarPairProps {
  first: AvatarPairPerson;
  second: AvatarPairPerson;
  size?: number;
}

/** Vorlage Z. 73–76. */
export function AvatarPair({ first, second, size = 30 }: AvatarPairProps): React.JSX.Element {
  return (
    <div className={styles.pair}>
      <Avatar initial={first.initial} slot={first.slot} size={size} />
      <Avatar initial={second.initial} slot={second.slot} size={size} overlap />
    </div>
  );
}
