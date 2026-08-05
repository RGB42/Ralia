import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader.js';
import { AppLayout } from './AppLayout.js';
import { Fab } from './Fab.js';
import { TABS } from './nav-items.js';

describe('TABS', () => {
  it('hat genau fuenf Eintraege in der Reihenfolge der Vorlage', () => {
    expect(TABS.map((t) => t.id)).toEqual(['kalender', 'planer', 'todos', 'geld', 'profil']);
  });
});

describe('AppLayout', () => {
  it('rendert Bottom-Nav und Sidebar-Navigation je einmal', () => {
    render(
      <AppLayout activeTab="kalender" onNavigate={() => {}}>
        <p>Inhalt</p>
      </AppLayout>,
    );
    // Beide Navigationen liegen im DOM; CSS entscheidet, welche sichtbar ist.
    // Unterhalb 1024px ist die Sidebar display:none — deshalb hidden:true,
    // sonst blendet Testing Library sie zu Recht aus.
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bereiche', hidden: true })).toBeInTheDocument();
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('meldet einen Tabwechsel', async () => {
    const onNavigate = vi.fn();
    render(
      <AppLayout activeTab="kalender" onNavigate={onNavigate}>
        <p>x</p>
      </AppLayout>,
    );
    const [geld] = screen.getAllByRole('button', { name: 'Geld' });
    expect(geld).toBeDefined();
    await userEvent.click(geld as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith('geld');
  });

  it('markiert den aktiven Tab in beiden Navigationen', () => {
    render(
      <AppLayout activeTab="todos" onNavigate={() => {}}>
        <p>x</p>
      </AppLayout>,
    );
    const current = screen
      .getAllByRole('button', { name: 'Todos', hidden: true })
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(2);
  });

  it('zeigt Paarung und Wochenzusammenfassung, wenn sie uebergeben werden', () => {
    render(
      <AppLayout
        activeTab="kalender"
        onNavigate={() => {}}
        pairing={{
          first: { initial: 'J', slot: 'u1' },
          second: { initial: 'L', slot: 'u2' },
          title: 'Jonas & Lena',
          subtitle: 'verbunden',
        }}
        sidebarSummary="11 Termine"
      >
        <p>x</p>
      </AppLayout>,
    );
    expect(screen.getByText('Jonas & Lena')).toBeInTheDocument();
    expect(screen.getByText('verbunden')).toBeInTheDocument();
    expect(screen.getByText('11 Termine')).toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('zeigt Kicker und Titel', () => {
    render(<AppHeader kicker="Gemeinsamer Kalender" title="Juli 2026" />);
    expect(screen.getByText('Gemeinsamer Kalender')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Juli 2026' })).toBeInTheDocument();
  });

  it('zeigt den Zurueck-Knopf nur mit onBack', () => {
    const { rerender } = render(<AppHeader kicker="k" title="t" />);
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
    rerender(<AppHeader kicker="k" title="t" onBack={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeInTheDocument();
  });

  it('bedient die Bereichsnavigation', async () => {
    const range = {
      onPrev: vi.fn(),
      onToday: vi.fn(),
      onNext: vi.fn(),
      prevLabel: 'Vorheriger Monat',
      todayLabel: 'Heute',
      nextLabel: 'Nächster Monat',
    };
    render(<AppHeader kicker="k" title="t" range={range} />);
    await userEvent.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Heute' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    expect(range.onPrev).toHaveBeenCalledOnce();
    expect(range.onToday).toHaveBeenCalledOnce();
    expect(range.onNext).toHaveBeenCalledOnce();
  });
});

describe('Fab', () => {
  it('traegt seinen Namen und meldet Klicks', async () => {
    const onClick = vi.fn();
    render(<Fab label="Termin hinzufügen" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
