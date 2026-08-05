import { Navigate, Outlet, type RouteObject } from 'react-router';
import { RedirectIfSignedIn, RequireAuth } from '../auth/RequireAuth.js';
import { ConnectPartnerScreen } from '../screens/auth/ConnectPartnerScreen.js';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen.js';
import { NewPasswordScreen } from '../screens/auth/NewPasswordScreen.js';
import { SignInScreen } from '../screens/auth/SignInScreen.js';
import { VerifyNoticeScreen } from '../screens/auth/VerifyNoticeScreen.js';
import { CalendarScreen } from '../screens/calendar/CalendarScreen.js';
import { MoneyScreen } from '../screens/money/MoneyScreen.js';
import { PlannerScreen } from '../screens/planner/PlannerScreen.js';
import { SettingsScreen } from '../screens/settings/SettingsScreen.js';
import { SyncScreen } from '../screens/settings/SyncScreen.js';
import { TodoDetail } from '../screens/todos/TodoDetail.js';
import { TodoOverview } from '../screens/todos/TodoOverview.js';
import { TodoStoreProvider } from '../screens/todos/todo-store.js';
import { AppFrame } from './AppFrame.js';

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

/**
 * Drei Gruppen, absichtlich getrennt:
 *
 *   1. **Offen fuer Abgemeldete** — die Anmeldeseiten. `RedirectIfSignedIn` haelt
 *      einen angemeldeten Nutzer davon fern, damit er nicht nach einem Passwort
 *      gefragt wird, das er nicht braucht.
 *   2. **`/passwort-neu` ohne Wache in beide Richtungen** — dort *ist* eine
 *      Sitzung da (der Recovery-Link liefert eine), und trotzdem darf es nicht
 *      weiter in die App. Diese Route muss aus beiden Zustaenden erreichbar sein.
 *   3. **Alles andere** hinter `RequireAuth`, in der AppShell.
 */
export const routes: RouteObject[] = [
  {
    element: <RedirectIfSignedIn />,
    children: [
      { path: '/anmelden', element: <SignInScreen /> },
      { path: '/passwort-vergessen', element: <ForgotPasswordScreen /> },
      { path: '/bestaetigen', element: <VerifyNoticeScreen /> },
    ],
  },
  { path: '/passwort-neu', element: <NewPasswordScreen /> },
  {
    element: <RequireAuth />,
    children: [
      // Ausserhalb der AppShell: hier gibt es noch keinen Kalender zu navigieren.
      { path: '/partner-verbinden', element: <ConnectPartnerScreen /> },
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
          { path: 'profil', element: <SettingsScreen /> },
          { path: 'profil/sync', element: <SyncScreen /> },
          { path: '*', element: <Navigate to="/kalender" replace /> },
        ],
      },
    ],
  },
];
