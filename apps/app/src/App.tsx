import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { AuthProvider } from './auth/AuthProvider.js';
import { BootGate } from './boot/BootGate.js';
import { DataProvider } from './data/DataProvider.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import { routes } from './routes/router.js';

// BASE_URL kommt aus vite.config.ts (Standard '/app/'); Render baut mit
// VITE_BASE_PATH='/', deshalb wird der Router-Basename daraus abgeleitet statt
// fest verdrahtet, damit beide nie auseinanderlaufen. '/' bleibt '/' (kein
// leerer Basename), alles andere verliert den abschliessenden Slash.
const rawBase = import.meta.env.BASE_URL;
const basename = rawBase === '/' ? '/' : rawBase.replace(/\/$/, '');
const router = createBrowserRouter(routes, { basename });

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
              <DataProvider>
                <RouterProvider router={router} />
              </DataProvider>
            </AuthProvider>
          </BootGate>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
