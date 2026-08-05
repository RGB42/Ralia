import type { WeekStart } from '@ralia/core';
import type { Lang } from '../../i18n/catalog.js';

/**
 * Datumsbeschriftungen ueber `Intl`, nicht ueber die festen deutschen Arrays
 * der Vorlage (Z. 1076–1077). Sonst waere die englische Fassung deutsch.
 *
 * Durchgehend UTC, wie das Monatsraster in packages/core — sonst verschieben
 * Zeitzonen mit negativem Offset das Datum um einen Tag.
 */

const DAY_MS = 86_400_000;

function localeOf(lang: Lang): string {
  return lang === 'en' ? 'en-GB' : 'de-DE';
}

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  return toIso(new Date(utcDate(iso).getTime() + days * DAY_MS));
}

export function monthName(monthIndex: number, lang: Lang): string {
  const date = new Date(Date.UTC(2000, monthIndex, 1));
  return new Intl.DateTimeFormat(localeOf(lang), { month: 'long', timeZone: 'UTC' }).format(date);
}

export function monthTitle(year: number, monthIndex: number, lang: Lang): string {
  return `${monthName(monthIndex, lang)} ${year}`;
}

/** Kurze Wochentagsnamen in der Reihenfolge des gewaehlten Wochenstarts. */
export function weekdayLabels(weekStart: WeekStart, lang: Lang): string[] {
  const formatter = new Intl.DateTimeFormat(localeOf(lang), {
    weekday: 'short',
    timeZone: 'UTC',
  });
  // 2024-01-01 war ein Montag; 2023-12-31 ein Sonntag.
  const anchor = weekStart === 'mo' ? Date.UTC(2024, 0, 1) : Date.UTC(2023, 11, 31);
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(anchor + index * DAY_MS)),
  );
}

/** Montag der Woche, in der `iso` liegt. */
export function weekStartIsoOf(iso: string, weekStart: WeekStart): string {
  const weekday = utcDate(iso).getUTCDay();
  const shift = weekStart === 'mo' ? (weekday + 6) % 7 : weekday;
  return addDaysIso(iso, -shift);
}

/**
 * ISO-8601-Kalenderwoche. Die Vorlage schreibt „31" fest hin (Z. 1473);
 * gerechnet bleibt es auch im naechsten Jahr richtig.
 */
export function isoWeekNumber(iso: string): number {
  const date = utcDate(iso);
  // Donnerstag der laufenden Woche bestimmt das Jahr der Woche.
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const offset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - offset + 3);
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}

/** „27. Jul – 2. Aug" — die Spanne einer Woche, wie in der Vorlage (Z. 1469–1470). */
export function weekRangeLabel(weekStartIso: string, lang: Lang): string {
  const endIso = addDaysIso(weekStartIso, 6);
  const formatter = new Intl.DateTimeFormat(localeOf(lang), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${formatter.format(utcDate(weekStartIso))} – ${formatter.format(utcDate(endIso))}`;
}

export function dayOfMonth(iso: string): number {
  return utcDate(iso).getUTCDate();
}

/** Kurzer Wochentagsname eines konkreten Datums. */
export function weekdayShort(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'short', timeZone: 'UTC' }).format(
    utcDate(iso),
  );
}

/** „29. Juli" — sprechender Name einer Rasterzelle. */
export function dayLabel(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(utcDate(iso));
}
