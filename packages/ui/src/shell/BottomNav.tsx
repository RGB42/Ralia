import { NavItem } from '../primitives/NavItem.js';
import styles from './BottomNav.module.css';
import { TABS, tabLabel, type TabId, type TabLabels } from './nav-items.js';

export interface BottomNavProps {
  activeTab: TabId;
  onNavigate(tab: TabId): void;
  navLabel?: string;
  labels?: TabLabels;
}

export function BottomNav({
  activeTab,
  onNavigate,
  navLabel = 'Hauptnavigation',
  labels,
}: BottomNavProps): React.JSX.Element {
  return (
    <nav className={styles.bottomNav} aria-label={navLabel}>
      {TABS.map((tab) => (
        <NavItem
          key={tab.id}
          active={tab.id === activeTab}
          label={tabLabel(tab.id, labels).bottom}
          icon={tab.icon}
          layout="bottom"
          onClick={() => onNavigate(tab.id)}
        />
      ))}
    </nav>
  );
}
