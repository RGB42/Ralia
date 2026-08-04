import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState.js';
import { Skeleton } from './Skeleton.js';
import { TOAST_DURATION_MS, ToastProvider } from './ToastProvider.js';
import { useToast } from './useToast.js';

function Trigger() {
  const { show } = useToast();
  return <button onClick={() => show('Gespeichert', 'ok')}>melden</button>;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('zeigt eine Meldung und blendet sie nach der Standzeit aus', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'melden' }));
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert');
    // act: der Timer raeumt den Toast per setState ab, React muss das flushen.
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS + 50));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('laesst sich vorzeitig schlieszen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'melden' }));
    await user.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('wirft ohne Provider mit klarer Meldung', () => {
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
  });
});

describe('EmptyState', () => {
  it('zeigt die Nachricht', () => {
    render(<EmptyState message="Keine Termine an diesem Tag" />);
    expect(screen.getByText('Keine Termine an diesem Tag')).toBeInTheDocument();
  });

  it('bietet auf Wunsch eine Handlung an', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmptyState message="Nichts hier" action={{ label: 'Anlegen', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Skeleton', () => {
  it('ist fuer Screenreader unsichtbar', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
