import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, Icon } from './Icon.js';

describe('Icon', () => {
  it.each(ICON_NAMES)('rendert %s mit den Maszen der Vorlage', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svg?.getAttribute('stroke-width')).toBe('1.6');
    expect(svg?.querySelectorAll('rect, line, circle, path, polyline').length).toBeGreaterThan(0);
  });

  it('ist ohne Titel fuer Screenreader unsichtbar', () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('wird mit Titel zum Bild mit Namen', () => {
    const { getByRole } = render(<Icon name="calendar" title="Kalender" />);
    expect(getByRole('img', { name: 'Kalender' })).toBeInTheDocument();
  });

  it('nutzt die Standardgroesse 17 und respektiert eine eigene', () => {
    const { container: a } = render(<Icon name="todos" />);
    expect(a.querySelector('svg')?.getAttribute('width')).toBe('17');
    const { container: b } = render(<Icon name="todos" size={19} />);
    expect(b.querySelector('svg')?.getAttribute('width')).toBe('19');
  });
});
