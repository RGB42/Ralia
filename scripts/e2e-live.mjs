#!/usr/bin/env node
/**
 * `npm run e2e:live` — Playwright mit RALIA_LIVE=1.
 *
 * Warum ein Skript und nicht `RALIA_LIVE=1 playwright test` direkt im
 * package.json: npm gibt Skripte unter Windows an cmd.exe, und cmd kennt das
 * vorangestellte VAR=wert nicht. `cross-env` waere die uebliche Antwort, aber
 * eine Abhaengigkeit fuer eine Zeile Umgebungsvariable ist keine gute Rechnung.
 *
 * Argumente werden durchgereicht: `npm run e2e:live -- --headed --debug`.
 */
import { spawn } from 'node:child_process';

const child = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  // Windows loest `npx` nur ueber die Shell auf — dort ist es eine .cmd-Datei.
  shell: process.platform === 'win32',
  env: { ...process.env, RALIA_LIVE: '1' },
});

child.on('exit', (code, signal) => {
  // Ein durch Signal beendeter Lauf hat keinen Code; 1 ist dann die ehrlichere
  // Antwort als 0, sonst gilt ein abgebrochener Lauf als bestanden.
  process.exit(code ?? (signal ? 1 : 0));
});
