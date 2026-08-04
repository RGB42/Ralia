import type { ReactNode } from 'react';
import type { PersonSlot } from '../person.js';
import { AvatarPair } from '../primitives/AvatarPair.js';
import { NavItem } from '../primitives/NavItem.js';
import styles from './Sidebar.module.css';
import { TABS, tabLabel, type TabId, type TabLabels } from './nav-items.js';

export interface SidebarPairing {
  first: { initial: string; slot: PersonSlot };
  second: { initial: string; slot: PersonSlot };
  title: string;
  subtitle: string;
}

export interface SidebarProps {
  activeTab: TabId;
  onNavigate(tab: TabId): void;
  pairing?: SidebarPairing;
  summary?: ReactNode;
  summaryTitle?: string;
  navLabel?: string;
  labels?: TabLabels;
}

export function Sidebar({
  activeTab,
  onNavigate,
  pairing,
  summary,
  summaryTitle = 'Diese Woche',
  navLabel = 'Bereiche',
  labels,
}: SidebarProps): React.JSX.Element {
  return (
    <div className={styles.sidebar}>
      {pairing ? (
        <div className={styles.pairing}>
          <AvatarPair first={pairing.first} second={pairing.second} />
          <div className={styles.pairingText}>
            <div className={styles.pairingTitle}>{pairing.title}</div>
            <div className={styles.pairingSubtitle}>{pairing.subtitle}</div>
          </div>
        </div>
      ) : null}
      <nav className={styles.nav} aria-label={navLabel}>
        {TABS.map((tab) => (
          <NavItem
            key={tab.id}
            active={tab.id === activeTab}
            label={tabLabel(tab.id, labels).sidebar}
            icon={tab.icon}
            layout="sidebar"
            onClick={() => onNavigate(tab.id)}
          />
        ))}
      </nav>
      {summary ? (
        <div className={styles.summary}>
          <div className={styles.summaryTitle}>{summaryTitle}</div>
          <div className={styles.summaryBody}>{summary}</div>
        </div>
      ) : null}
    </div>
  );
}
