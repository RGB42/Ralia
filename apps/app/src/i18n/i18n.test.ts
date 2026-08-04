import { describe, expect, it } from 'vitest';
import de from './de.json';
import en from './en.json';

const deKeys = Object.keys(de);
const enKeys = Object.keys(en);

describe('Uebersetzungskataloge', () => {
  it('haben identische Schluesselmengen', () => {
    expect(new Set(deKeys)).toEqual(new Set(enKeys));
  });

  it('enthalten die Schluessel aus Ralia_Opus plus die Zusaetze', () => {
    // i18n.js liefert 552 eindeutige Schluessel; additions.json bringt 10 dazu.
    expect(deKeys.length).toBeGreaterThanOrEqual(546);
  });

  it('haben keine leeren Werte', () => {
    for (const [key, value] of Object.entries(de)) {
      expect(value, `de.${key} ist leer`).not.toBe('');
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.${key} ist leer`).not.toBe('');
    }
  });

  it('sind alphabetisch sortiert, damit Diffs lesbar bleiben', () => {
    expect(deKeys).toEqual([...deKeys].sort());
    expect(enKeys).toEqual([...enKeys].sort());
  });

  it('enthalten die Navigations-Schluessel der AppShell', () => {
    for (const key of [
      'navCalendar',
      'navCalendarShort',
      'navPlanner',
      'navPlannerShort',
      'navTodos',
      'navTodosShort',
      'navMoney',
      'navMoneyShort',
      'navSettings',
      'navProfileShort',
    ]) {
      expect(deKeys, `de fehlt ${key}`).toContain(key);
      expect(enKeys, `en fehlt ${key}`).toContain(key);
    }
  });

  it('uebernimmt Stichproben wortgleich aus Ralia_Opus', () => {
    expect((de as Record<string, string>).appSubtitle).toBe('Teile Deine Tage gemeinsam');
    expect((de as Record<string, string>).loginButton).toBe('Anmelden');
  });
});
