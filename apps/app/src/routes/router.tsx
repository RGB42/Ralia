import { Navigate, Outlet, type RouteObject } from 'react-router';
import { CalendarScreen } from '../screens/calendar/CalendarScreen.js';
import { MoneyScreen } from '../screens/money/MoneyScreen.js';
import { PlannerScreen } from '../screens/planner/PlannerScreen.js';
import { TodoDetail } from '../screens/todos/TodoDetail.js';
import { TodoOverview } from '../screens/todos/TodoOverview.js';
import { TodoStoreProvider } from '../screens/todos/todo-store.js';
import { AppFrame } from './AppFrame.js';

/** Platzhalter fuer die noch offenen Screens. */
function Placeholder({ name }: { name: string }): React.JSX.Element {
  return <p>{name}</p>;
}

/**
 * Der Todo-Zustand haengt an einer Elternroute statt an den Screens: sonst
 * verpufft ein Abhaken im Detail beim Zurueckgehen zur Uebersicht.
 */
function TodoBranch(): React.JSX.Element {
  return (
    <TodoStoreProvider>
      <Outlet />
    </TodoStoreProvider>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <Navigate to="/kalender" replace /> },
      { path: 'kalender', element: <CalendarScreen /> },
      { path: 'planer', element: <PlannerScreen /> },
      {
        path: 'todos',
        element: <TodoBranch />,
        children: [
          { index: true, element: <TodoOverview /> },
          { path: ':listId', element: <TodoDetail /> },
        ],
      },
      { path: 'geld', element: <MoneyScreen /> },
      { path: 'profil', element: <Placeholder name="Einstellungen" /> },
      { path: 'profil/sync', element: <Placeholder name="Google Kalender" /> },
      { path: '*', element: <Navigate to="/kalender" replace /> },
    ],
  },
];
