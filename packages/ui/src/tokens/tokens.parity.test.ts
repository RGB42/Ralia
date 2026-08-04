import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const templateSrc = readFileSync(
  fileURLToPath(new URL('../../../../docs/design-reference/Ralia-Organizer.dc.html', import.meta.url)),
  'utf8',
);
const tokensSrc = readFileSync(`${here}tokens.css`, 'utf8');

/** Liest alle Custom Properties eines Selektor-Blocks. */
function customProps(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`Block nicht gefunden: ${selector}`);
  const body = match[1] ?? '';
  const out = new Map<string, string>();
  for (const decl of body.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim();
    if (!prop.startsWith('--')) continue;
    out.set(prop, decl.slice(colon + 1).trim().replace(/\s+/g, ' '));
  }
  return out;
}

/** Liest einen Eintrag der colors()-Map aus der Logik der Vorlage. */
function templatePersonColors(slot: string): {
  bar: string; bgDark: string; bgLight: string; fgDark: string; fgLight: string;
} {
  const re = new RegExp(
    `${slot}\\s*:\\s*\\{\\s*bar\\s*:\\s*'([^']+)'\\s*,\\s*` +
      `bg\\s*:\\s*dark\\s*\\?\\s*'([^']+)'\\s*:\\s*'([^']+)'\\s*,\\s*` +
      `fg\\s*:\\s*dark\\s*\\?\\s*'([^']+)'\\s*:\\s*'([^']+)'`,
  );
  const m = re.exec(templateSrc);
  if (!m) throw new Error(`colors()-Eintrag fehlt in der Vorlage: ${slot}`);
  return { bar: m[1]!, bgDark: m[2]!, bgLight: m[3]!, fgDark: m[4]!, fgLight: m[5]! };
}

describe('Token-Parität mit der Design-Vorlage', () => {
  it('deckt jede sichtbare Light-Eigenschaft der Vorlage ab', () => {
    const template = customProps(templateSrc, ':root');
    const ours = customProps(tokensSrc, ':root');
    for (const [prop, value] of template) {
      expect(ours.get(prop), `--> ${prop} fehlt oder weicht ab`).toBe(value);
    }
  });

  it('deckt jede sichtbare Dark-Eigenschaft der Vorlage ab', () => {
    const template = customProps(templateSrc, ':root[data-ralia-theme="dark"]');
    const ours = customProps(tokensSrc, ':root[data-ralia-theme="dark"]');
    for (const [prop, value] of template) {
      expect(ours.get(prop), `--> dark ${prop} fehlt oder weicht ab`).toBe(value);
    }
  });

  it.each(['u1', 'u2', 'both', 'bday'])('hebt die Personenfarben von %s in Tokens', (slot) => {
    const c = templatePersonColors(slot);
    const light = customProps(tokensSrc, ':root');
    const dark = customProps(tokensSrc, ':root[data-ralia-theme="dark"]');
    expect(light.get(`--${slot}`)).toBe(c.bar);
    expect(light.get(`--${slot}-bg`)).toBe(c.bgLight);
    expect(light.get(`--${slot}-fg`)).toBe(c.fgLight);
    expect(dark.get(`--${slot}-bg`)).toBe(c.bgDark);
    expect(dark.get(`--${slot}-fg`)).toBe(c.fgDark);
    // Die Balkenfarbe ist in beiden Themes identisch — die Vorlage überschreibt sie nicht.
    expect(dark.has(`--${slot}`)).toBe(false);
  });

  it('hebt den ausgeschalteten Toggle-Track in Tokens', () => {
    const m = /const track = \(on\) => on \? fill : \(s\.dark \? '([^']+)' : '([^']+)'\)/.exec(templateSrc);
    expect(m, 'track()-Definition fehlt in der Vorlage').not.toBeNull();
    expect(customProps(tokensSrc, ':root').get('--track-off')).toBe(m![2]);
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').get('--track-off')).toBe(m![1]);
  });

  it('hebt die Heute-Markierungen in Tokens', () => {
    const border = /border: isToday \? \(s\.dark \? '([^']+)' : '([^']+)'\) : line/.exec(templateSrc);
    expect(border, 'Heute-Rand fehlt in der Vorlage').not.toBeNull();
    expect(customProps(tokensSrc, ':root').get('--today-line')).toBe(border![2]);
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').get('--today-line')).toBe(border![1]);

    const col = /colBg: isToday \? \(s\.dark \? '([^']+)' : '([^']+)'\) : 'transparent'/.exec(templateSrc);
    expect(col, 'Heute-Spaltenhintergrund fehlt in der Vorlage').not.toBeNull();
    expect(customProps(tokensSrc, ':root').get('--today-col')).toBe(col![2]);
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').get('--today-col')).toBe(col![1]);
  });

  it('setzt --brand-fill themenunabhängig', () => {
    expect(customProps(tokensSrc, ':root').get('--brand-fill')).toBe('#7c3aed');
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').has('--brand-fill')).toBe(false);
  });
});
