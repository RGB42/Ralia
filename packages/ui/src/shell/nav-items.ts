import type { IconName } from '../icons/Icon.js';

export type TabId = 'kalender' | 'planer' | 'todos' | 'geld' | 'profil';

export interface TabDef {
  id: TabId;
  icon: IconName;
  path: string;
  /** i18n-Schluessel fuer die Sidebar (mehr Platz). */
  sidebarLabelKey: string;
  /** i18n-Schluessel fuer die Bottom-Nav (kurz). */
  bottomLabelKey: string;
}

/**
 * Die Vorlage beschriftet dieselben Ziele in Sidebar und Bottom-Nav
 * unterschiedlich (Z. 86/690 „Wochenplaner" gegen „Planer", Z. 95/702
 * „Einstellungen" gegen „Profil"). Das bleibt so: in einer fuenfspaltigen
 * Bottom-Nav ist die kurze Form notwendig, nicht Geschmack.
 */
export const TABS: readonly TabDef[] = [
  {
    id: 'kalender',
    icon: 'calendar',
    path: '/kalender',
    sidebarLabelKey: 'navCalendar',
    bottomLabelKey: 'navCalendarShort',
  },
  {
    id: 'planer',
    icon: 'planner',
    path: '/planer',
    sidebarLabelKey: 'navPlanner',
    bottomLabelKey: 'navPlannerShort',
  },
  {
    id: 'todos',
    icon: 'todos',
    path: '/todos',
    sidebarLabelKey: 'navTodos',
    bottomLabelKey: 'navTodosShort',
  },
  {
    id: 'geld',
    icon: 'money',
    path: '/geld',
    sidebarLabelKey: 'navMoney',
    bottomLabelKey: 'navMoneyShort',
  },
  {
    id: 'profil',
    icon: 'settings',
    path: '/profil',
    sidebarLabelKey: 'navSettings',
    bottomLabelKey: 'navProfileShort',
  },
];

export const SIDEBAR_BREAKPOINT_PX = 1024;

export interface TabLabel {
  sidebar: string;
  bottom: string;
}

export type TabLabels = Partial<Record<TabId, TabLabel>>;

/**
 * Deutsche Beschriftungen der Vorlage als Rueckfallebene. Die App uebergibt
 * die Katalogwerte; ohne i18n-Provider bleibt die Shell trotzdem lesbar.
 */
export const DEFAULT_TAB_LABELS: Record<TabId, TabLabel> = {
  kalender: { sidebar: 'Kalender', bottom: 'Kalender' },
  planer: { sidebar: 'Wochenplaner', bottom: 'Planer' },
  todos: { sidebar: 'Todos', bottom: 'Todos' },
  geld: { sidebar: 'Geld', bottom: 'Geld' },
  profil: { sidebar: 'Einstellungen', bottom: 'Profil' },
};

export function tabLabel(id: TabId, labels: TabLabels | undefined): TabLabel {
  return labels?.[id] ?? DEFAULT_TAB_LABELS[id];
}
