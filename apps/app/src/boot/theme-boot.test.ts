import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { themeBootScript } from '@ralia/ui';
import { describe, expect, it } from 'vitest';

/**
 * `import.meta.url` ist im dom-Projekt keine file:-URL — Vite liefert die
 * Module dort ueber http, und `fileURLToPath` wirft. Deshalb vom
 * Arbeitsverzeichnis aus nach oben suchen: das funktioniert gleichermaszen,
 * ob vitest in der Wurzel oder in apps/app gestartet wurde.
 */
function findRepoFile(relative: string): string {
  let dir = process.cwd();
  for (let level = 0; level < 6; level += 1) {
    const candidate = resolve(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`nicht gefunden: ${relative}`);
}

/**
 * Das Inline-Skript in index.html ist eine zweite Kopie derselben Logik —
 * anders geht es nicht, es muss vor dem ersten Frame laufen und darf kein
 * Modul laden. Dieser Test verhindert, dass die Kopien auseinanderdriften.
 */
describe('Theme-Boot-Skript', () => {
  it('stimmt mit themeBootScript() ueberein', () => {
    const html = readFileSync(findRepoFile('apps/app/index.html'), 'utf8');
    const normalize = (s: string) => s.replace(/\s+/g, '');
    expect(normalize(html)).toContain(normalize(themeBootScript()));
  });
});
