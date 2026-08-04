import { AppLayout, TABS, type TabId } from '@ralia/ui';
import { Outlet, useLocation, useNavigate } from 'react-router';

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
  const activeTab = tabFromPath(pathname);

  return (
    <AppLayout
      activeTab={activeTab}
      onNavigate={(tab) => {
        const target = TABS.find((t) => t.id === tab);
        if (target) void navigate(target.path);
      }}
    >
      <Outlet />
    </AppLayout>
  );
}
