import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { BootGate } from './boot/BootGate.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import { routes } from './routes/router.js';

const router = createBrowserRouter(routes, { basename: '/app' });

/**
 * Reihenfolge der Provider ist bindend: BootGate meldet Warnungen als Toast
 * und braucht dafuer den ToastProvider ueber sich, und seine Texte sind
 * uebersetzt, also auch den I18nProvider.
 */
export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <BootGate>
            <RouterProvider router={router} />
          </BootGate>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
