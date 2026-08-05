import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.js';
import { BootGate } from './boot/BootGate.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import { routes } from './routes/router.js';

const router = createBrowserRouter(routes, { basename: '/app' });

/**
 * Reihenfolge der Provider ist bindend:
 *
 *   ThemeProvider   setzt das Attribut am <html>, muss ganz aussen sein
 *   I18nProvider    weil alles darunter uebersetzte Texte zeigt
 *   ToastProvider   BootGate und AuthProvider melden ueber Toasts
 *   BootGate        liefert die Runtime-Konfiguration; erst danach steht der
 *                   Supabase-Schluessel fest
 *   AuthProvider    braucht genau diese Konfiguration und muss ueber dem Router
 *                   liegen, weil die Routenwache ihn liest
 */
export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <BootGate>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </BootGate>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
