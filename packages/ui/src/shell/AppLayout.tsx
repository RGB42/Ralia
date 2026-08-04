import type { ReactNode } from 'react';
import styles from './AppLayout.module.css';
import { BottomNav } from './BottomNav.js';
import { Sidebar, type SidebarPairing } from './Sidebar.js';
import type { TabId, TabLabels } from './nav-items.js';

export interface AppLayoutProps {
  activeTab: TabId;
  onNavigate(tab: TabId): void;
  /** Inhalt des „Diese Woche"-Panels. packages/ui kennt keine Termindaten. */
  sidebarSummary?: ReactNode;
  pairing?: SidebarPairing;
  labels?: TabLabels;
  children: ReactNode;
}

export function AppLayout({
  activeTab,
  onNavigate,
  sidebarSummary,
  pairing,
  labels,
  children,
}: AppLayoutProps): React.JSX.Element {
  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>
        <Sidebar
          activeTab={activeTab}
          onNavigate={onNavigate}
          {...(sidebarSummary ? { summary: sidebarSummary } : {})}
          {...(pairing ? { pairing } : {})}
          {...(labels ? { labels } : {})}
        />
      </div>
      <div className={styles.column}>
        <main className={styles.content}>{children}</main>
        <div className={styles.bottomSlot}>
          <BottomNav
            activeTab={activeTab}
            onNavigate={onNavigate}
            {...(labels ? { labels } : {})}
          />
        </div>
      </div>
    </div>
  );
}
