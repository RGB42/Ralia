import { Skeleton } from '@ralia/ui';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth.js';

/**
 * Wache vor allem, was eine Identität braucht.
 *
 * Drei Zustände, und die Reihenfolge ist wichtig:
 *
 *   1. **Noch unbekannt.** Ein Platzhalter, kein Weiterleiten. Würde hier auf
 *      `/anmelden` geleitet, blitzte der Anmeldebildschirm bei jedem Reload auf,
 *      bevor die Sitzung gelesen ist — und der Nutzer verlöre seine Route.
 *   2. **Passwort-Rücksprung offen.** Die Sitzung ist gültig, aber ein
 *      weitergeleiteter Reset-Link darf kein Zugang zur ganzen App sein. Es geht
 *      nur auf „neues Passwort setzen".
 *   3. **Abgemeldet.** Auf `/anmelden`, mit dem Ziel im Zustand, damit die
 *      Anmeldung dorthin zurückführt statt immer in den Kalender.
 */
export function RequireAuth(): React.JSX.Element {
  const { session, loading, pendingRecovery } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 12, padding: 16 }}>
        <Skeleton height={22} width="45%" />
        <Skeleton height={220} radius={20} />
      </div>
    );
  }

  if (pendingRecovery && location.pathname !== '/passwort-neu') {
    return <Navigate to="/passwort-neu" replace />;
  }

  if (session.status !== 'signed-in') {
    return <Navigate to="/anmelden" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/**
 * Das Gegenstück: die Anmeldeseiten sollen einen angemeldeten Nutzer nicht
 * noch einmal nach dem Passwort fragen.
 *
 * Ausnahme ist der offene Passwort-Rücksprung — dort *ist* eine Sitzung da und
 * der Nutzer muss trotzdem auf die Passwortseite.
 */
export function RedirectIfSignedIn(): React.JSX.Element {
  const { session, loading, pendingRecovery } = useAuth();

  if (loading) return <Outlet />;
  if (pendingRecovery) return <Navigate to="/passwort-neu" replace />;
  if (session.status === 'signed-in') return <Navigate to="/kalender" replace />;
  return <Outlet />;
}
