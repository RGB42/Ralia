import { Navigate, type RouteObject } from 'react-router';
import { CalendarScreen } from '../screens/calendar/CalendarScreen.js';
import { PlannerScreen } from '../screens/planner/PlannerScreen.js';
import { AppFrame } from './AppFrame.js';

/** Platzhalter fuer die noch offenen Screens. */
function Placeholder({ name }: { name: string }): React.JSX.Element {
  return <p>{name}</p>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <Navigate to="/kalender" replace /> },
      { path: 'kalender', element: <CalendarScreen /> },
      { path: 'planer', element: <PlannerScreen /> },
      { path: 'todos', element: <Placeholder name="Todos" /> },
      { path: 'todos/:listId', element: <Placeholder name="Liste" /> },
      { path: 'geld', element: <Placeholder name="Geld" /> },
      { path: 'profil', element: <Placeholder name="Einstellungen" /> },
      { path: 'profil/sync', element: <Placeholder name="Google Kalender" /> },
      { path: '*', element: <Navigate to="/kalender" replace /> },
    ],
  },
];
