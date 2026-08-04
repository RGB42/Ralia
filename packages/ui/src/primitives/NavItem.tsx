import { Icon, type IconName } from '../icons/Icon.js';
import styles from './NavItem.module.css';

export interface NavItemProps {
  active: boolean;
  label: string;
  icon: IconName;
  layout: 'sidebar' | 'bottom';
  onClick(): void;
}

export function NavItem({ active, label, icon, layout, onClick }: NavItemProps): React.JSX.Element {
  const classes = [styles.navItem, styles[layout], active ? styles.active : null]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      // exactOptionalPropertyTypes: aria-current darf nicht als undefined durch.
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <Icon name={icon} size={layout === 'bottom' ? 19 : 17} />
      <span>{label}</span>
    </button>
  );
}
