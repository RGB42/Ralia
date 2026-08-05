import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Avatar } from './Avatar.js';
import { AvatarPair } from './AvatarPair.js';
import { Card } from './Card.js';
import { FieldLabel } from './FieldLabel.js';
import { Input } from './Input.js';
import { ListRow } from './ListRow.js';
import { ProgressBar } from './ProgressBar.js';
import { Select } from './Select.js';
import { Textarea } from './Textarea.js';

/**
 * Beide Felder sind kontrolliert. Ein festes `value=""` wuerde jeden Anschlag
 * verwerfen, und die Meldung waere immer nur das letzte Zeichen — deshalb
 * halten die Tests den Wert wie ein echter Aufrufer im State.
 */
function ControlledInput({ onChange }: { onChange: (next: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Input
      id="titel"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function ControlledTextarea({ onChange }: { onChange: (next: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Textarea
      id="n"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('Input', () => {
  it('meldet jede Eingabe als Klartext', async () => {
    const onChange = vi.fn();
    render(<ControlledInput onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'Yoga');
    expect(onChange).toHaveBeenLastCalledWith('Yoga');
  });

  it('verbindet sich mit einem FieldLabel', () => {
    render(
      <>
        <FieldLabel htmlFor="ort">Ort</FieldLabel>
        <Input id="ort" value="" onChange={() => {}} />
      </>,
    );
    expect(screen.getByLabelText('Ort')).toBeInTheDocument();
  });

  it('uebernimmt den Typ', () => {
    render(<Input id="d" value="2026-07-29" onChange={() => {}} type="date" />);
    expect(document.querySelector('input[type="date"]')).not.toBeNull();
  });
});

describe('Textarea', () => {
  it('meldet Eingaben', async () => {
    const onChange = vi.fn();
    render(<ControlledTextarea onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hi');
    expect(onChange).toHaveBeenLastCalledWith('Hi');
  });
});

describe('Select', () => {
  it('meldet die Auswahl', async () => {
    const onChange = vi.fn();
    render(
      <Select
        id="s"
        value="a"
        onChange={onChange}
        options={
          [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ] as const
        }
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('ListRow', () => {
  it('ist ohne onClick kein Knopf', () => {
    render(<ListRow title="Geburtstag" hint="jaehrlich" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Geburtstag')).toBeInTheDocument();
  });

  it('ist mit onClick ein Knopf mit Titel als Name', async () => {
    const onClick = vi.fn();
    render(<ListRow title="Kalender verwalten" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Kalender verwalten/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Avatar', () => {
  it('nutzt die Slot-Farbe als Token', () => {
    render(<Avatar initial="J" slot="u1" />);
    const style = screen.getByText('J').getAttribute('style') ?? '';
    expect(style).toContain('var(--u1)');
  });
});

describe('AvatarPair', () => {
  it('zeigt beide Initialen', () => {
    render(
      <AvatarPair first={{ initial: 'J', slot: 'u1' }} second={{ initial: 'L', slot: 'u2' }} />,
    );
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('meldet den Fortschritt als Messwert', () => {
    render(<ProgressBar label="Budget" segments={[{ widthPct: 70, color: 'var(--brand)' }]} />);
    const bar = screen.getByRole('progressbar', { name: 'Budget' });
    expect(bar).toHaveAttribute('aria-valuenow', '70');
  });

  it('addiert mehrere Segmente fuer den Messwert', () => {
    render(
      <ProgressBar
        label="Freizeit"
        segments={[
          { widthPct: 20, color: 'var(--u1)' },
          { widthPct: 25, color: 'var(--u2)' },
        ]}
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Freizeit' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );
  });

  it('deckelt den Messwert bei 100', () => {
    render(<ProgressBar label="Wohnen" segments={[{ widthPct: 140, color: 'var(--u1)' }]} />);
    expect(screen.getByRole('progressbar', { name: 'Wohnen' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});

describe('Card', () => {
  it('rendert seinen Inhalt', () => {
    render(
      <Card>
        <p>Inhalt</p>
      </Card>,
    );
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });
});
