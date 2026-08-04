import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { Chip } from './Chip.js';
import { IconButton } from './IconButton.js';
import { NavItem } from './NavItem.js';
import { PersonChip } from './PersonChip.js';
import { SegmentSwitch } from './SegmentSwitch.js';
import { Toggle } from './Toggle.js';

describe('Button', () => {
  it('loest onClick aus', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('loest deaktiviert nicht aus', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Speichern
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ist per Tastatur bedienbar', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ist standardmaeszig type=button, damit es kein Formular abschickt', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('IconButton', () => {
  it('traegt seinen Namen fuer Screenreader', () => {
    render(
      <IconButton label="Naechster Monat" onClick={() => {}}>
        ›
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Naechster Monat' })).toBeInTheDocument();
  });
});

describe('SegmentSwitch', () => {
  const options = [
    { value: 'monat', label: 'Monat' },
    { value: 'woche', label: 'Woche' },
  ] as const;

  it('kennzeichnet den aktiven Eintrag', () => {
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Monat' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Woche' })).not.toBeChecked();
  });

  it('meldet einen Wechsel per Klick', async () => {
    const onChange = vi.fn();
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Woche' }));
    expect(onChange).toHaveBeenCalledWith('woche');
  });

  it('wechselt mit den Pfeiltasten', async () => {
    const onChange = vi.fn();
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Monat' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('woche');
  });

  it('laeuft am Ende wieder nach vorn', async () => {
    const onChange = vi.fn();
    render(<SegmentSwitch label="Ansicht" options={options} value="woche" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Woche' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('monat');
  });

  it('traegt den Gruppennamen', () => {
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Ansicht' })).toBeInTheDocument();
  });
});

describe('NavItem', () => {
  it('markiert die aktive Seite', () => {
    render(<NavItem active label="Kalender" icon="calendar" layout="bottom" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Kalender' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('laesst aria-current bei inaktiven Eintraegen weg', () => {
    render(<NavItem active={false} label="Geld" icon="money" layout="bottom" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Geld' })).not.toHaveAttribute('aria-current');
  });
});

describe('PersonChip', () => {
  it('kennzeichnet den gedrueckten Zustand', () => {
    render(<PersonChip slot="u1" active label="Jonas" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Jonas' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('setzt die Personenfarbe als Token, nicht als Literal', () => {
    render(<PersonChip slot="u2" active label="Lena" onClick={() => {}} />);
    const style = screen.getByRole('button', { name: 'Lena' }).getAttribute('style') ?? '';
    expect(style).toContain('var(--u2');
    expect(style).not.toMatch(/#[0-9a-f]{6}/i);
  });
});

describe('Chip', () => {
  it('meldet einen Klick', async () => {
    const onClick = vi.fn();
    render(<Chip active={false} label="Alle" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Toggle', () => {
  it('ist ein Schalter mit Zustand', () => {
    render(<Toggle checked label="Dark Mode" onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Dark Mode' })).toBeChecked();
  });

  it('kippt den Wert', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} label="Push" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Push' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reagiert auf die Leertaste', async () => {
    const onChange = vi.fn();
    render(<Toggle checked label="Push" onChange={onChange} />);
    screen.getByRole('switch', { name: 'Push' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
