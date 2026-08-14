import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Wie in `boot/theme-boot.test.ts`: `import.meta.url` ist im dom-Projekt keine
 * file:-URL, deshalb vom Arbeitsverzeichnis aus nach oben suchen.
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
 * Die Config wird gelesen statt importiert: ein `import` der vite.config zieht
 * esbuild in die jsdom-Umgebung, und dort scheitert schon `TextEncoder`
 * ("new TextEncoder().encode('') instanceof Uint8Array is incorrectly false").
 *
 * Render veroeffentlicht den kompletten `dist`-Ordner. Eine erzeugte
 * `.js.map` liegt damit oeffentlich neben dem Bundle — beim Stand vom
 * 2026-08-12 waren das 3,4 MB abrufbarer Volltext-Quellcode unter
 * `https://ralia-app.onrender.com/assets/index-*.js.map`.
 *
 * `'hidden'` waere keine Korrektur: die Datei entsteht trotzdem und bleibt
 * unter ihrem Namen abrufbar, nur der Verweis im Bundle fehlt. Deshalb wird
 * auf das ausdrueckliche `sourcemap: false` geprueft und nicht bloss darauf,
 * dass `true` fehlt.
 */
describe('Produktions-Build', () => {
  it('schaltet die Sourcemap ausdruecklich ab', () => {
    const config = readFileSync(findRepoFile('apps/app/vite.config.ts'), 'utf8');
    expect(config).toMatch(/sourcemap:\s*false/);
  });
});
