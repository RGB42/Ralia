#!/usr/bin/env node
/**
 * Holt die Uebersetzungen aus Ralia_Opus nach apps/app/src/i18n/.
 *
 * Aufruf: node scripts/extract-i18n.mjs [--source <pfad-zu-i18n.js>] [--check]
 *
 * --check schreibt nicht, sondern prueft nur, ob die vorhandenen Dateien
 * dem entsprechen, was das Skript erzeugen wuerde. Fuer CI.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../apps/app/src/i18n/', import.meta.url));
const ADDITIONS = `${OUT_DIR}additions.json`;

/**
 * Ralia_Opus liegt im Normalfall als Schwesterverzeichnis neben diesem Repo.
 * Der Windows-Pfad ist der Arbeitsplatz des Autors und bleibt als letzter
 * Versuch stehen; --source schlaegt beides.
 */
const SOURCE_CANDIDATES = [
  fileURLToPath(new URL('../../Ralia_Opus/public/js/i18n.js', import.meta.url)),
  'N:/Programme/EigeneProjekte/Ralia_Opus/public/js/i18n.js',
];

const args = process.argv.slice(2);
const check = args.includes('--check');
const sourceArg = args.indexOf('--source');

function resolveSource() {
  if (sourceArg !== -1) {
    const explicit = args[sourceArg + 1];
    if (!explicit) throw new Error('--source ohne Pfad');
    return explicit;
  }
  const found = SOURCE_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `i18n.js nicht gefunden. Gesucht in:\n  ${SOURCE_CANDIDATES.join('\n  ')}\n` +
        'Mit --source <pfad> einen anderen Ort angeben.',
    );
  }
  return found;
}

/** Findet das schliessende `}` zum `{` an `start`, unter Beachtung von Strings. */
function matchBrace(src, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('Objektliteral nicht geschlossen');
}

function readTranslations(src) {
  const anchor = src.indexOf('const translations = {');
  if (anchor === -1) throw new Error('`const translations = {` nicht gefunden');
  const open = src.indexOf('{', anchor);
  const close = matchBrace(src, open);
  const literal = src.slice(open, close + 1);
  // Reines Datenliteral aus dem eigenen Repo — kein Fremdcode. Ein Zeilenparser
  // scheiterte hier an Apostrophen, Emoji und Escapes in den Werten.
  const value = new Function(`return (${literal});`)();
  if (!value.de || !value.en) throw new Error('de oder en fehlt im Katalog');
  return { value, literal };
}

/** Doppelte Schluessel melden: im Objektliteral gewinnt der letzte. */
function findDuplicates(literal, lang) {
  const langStart = literal.indexOf(`${lang}: {`);
  if (langStart === -1) return [];
  const open = literal.indexOf('{', langStart);
  const block = literal.slice(open, matchBrace(literal, open) + 1);
  const seen = new Set();
  const dupes = [];
  for (const match of block.matchAll(/^\s{8}([A-Za-z0-9_]+)\s*:/gm)) {
    const key = match[1];
    if (seen.has(key)) dupes.push(key);
    else seen.add(key);
  }
  return dupes;
}

function sortedJson(record) {
  const sorted = {};
  for (const key of Object.keys(record).sort()) sorted[key] = record[key];
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

const source = resolveSource();
const src = readFileSync(source, 'utf8');
const { value, literal } = readTranslations(src);

for (const lang of ['de', 'en']) {
  const dupes = findDuplicates(literal, lang);
  if (dupes.length > 0) {
    console.warn(
      `[${lang}] ${dupes.length} doppelte Schluessel, letzter gewinnt: ${dupes.join(', ')}`,
    );
  }
}

const additions = JSON.parse(readFileSync(ADDITIONS, 'utf8'));
const merged = {
  de: { ...value.de, ...additions.de },
  en: { ...value.en, ...additions.en },
};

const deKeys = Object.keys(merged.de).sort();
const enKeys = Object.keys(merged.en).sort();
const onlyDe = deKeys.filter((k) => !(k in merged.en));
const onlyEn = enKeys.filter((k) => !(k in merged.de));
if (onlyDe.length > 0 || onlyEn.length > 0) {
  console.error(
    `Schluesselmengen weichen ab.\n  nur de: ${onlyDe.join(', ')}\n  nur en: ${onlyEn.join(', ')}`,
  );
  process.exit(1);
}

let failed = false;
for (const lang of ['de', 'en']) {
  const target = `${OUT_DIR}${lang}.json`;
  const next = sortedJson(merged[lang]);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== next) {
      console.error(`${lang}.json ist nicht aktuell — fuehre \`npm run i18n:extract\` aus`);
      failed = true;
    }
  } else {
    writeFileSync(target, next, 'utf8');
  }
}
if (failed) process.exit(1);

console.log(
  `${deKeys.length} Schluessel je Sprache${check ? ' geprueft' : ' geschrieben'} (Quelle: ${source})`,
);
