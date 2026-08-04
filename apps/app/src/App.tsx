import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { I18nProvider } from './i18n/I18nProvider.js';
import { routes } from './routes/router.js';

const router = createBrowserRouter(routes, { basename: '/app' });

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
