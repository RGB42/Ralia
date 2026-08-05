import { AppLayout, TABS, type TabId, type TabLabel } from '@ralia/ui';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useT } from '../i18n/useT.js';

function tabFromPath(pathname: string): TabId {
  const match = TABS.find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`));
  return match?.id ?? 'kalender';
}

/**
 * Die Naht zwischen Router und Shell: der Pfad bestimmt den aktiven Tab,
 * ein Tabklick bestimmt den Pfad. packages/ui kennt den Router nicht.
 */
export function AppFrame(): React.JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const activeTab = tabFromPath(pathname);

  const labels = Object.fromEntries(
    TABS.map((tab) => [tab.id, { sidebar: t(tab.sidebarLabelKey), bottom: t(tab.bottomLabelKey) }]),
  ) as Record<TabId, TabLabel>;

  return (
    <AppLayout
      activeTab={activeTab}
      labels={labels}
      onNavigate={(tab) => {
        const target = TABS.find((t) => t.id === tab);
        if (target) void navigate(target.path);
      }}
    >
      <Outlet />
    </AppLayout>
  );
}
