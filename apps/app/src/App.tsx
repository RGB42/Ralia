import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { routes } from './routes/router.js';

const router = createBrowserRouter(routes, { basename: '/app' });

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>
  );
}
