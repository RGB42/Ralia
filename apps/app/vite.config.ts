import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // Web serviert die App unter /app/*; / gehoert der Marketing-Site (SP8).
  // SP7 stellt fuer Capacitor auf './' um. VITE_BASE_PATH ueberschreibt das fuer
  // Render (render.yaml), wo diese Site allein an der Domainwurzel liegt.
  base: process.env.VITE_BASE_PATH ?? '/app/',
  plugins: [react()],
  resolve: {
    // Array-Form mit Regex, nicht Objekt-Form: ein String-Alias ersetzt auch
    // das Praefix von Unterpfaden, und '@ralia/ui/tokens/tokens.css' wuerde
    // zu 'packages/ui/src/index.ts/tokens/tokens.css'.
    alias: [
      { find: /^@ralia\/core\/(.*)$/, replacement: resolvePath('../../packages/core/src/$1') },
      { find: /^@ralia\/core$/, replacement: resolvePath('../../packages/core/src/index.ts') },
      { find: /^@ralia\/data\/(.*)$/, replacement: resolvePath('../../packages/data/src/$1') },
      { find: /^@ralia\/data$/, replacement: resolvePath('../../packages/data/src/index.ts') },
      { find: /^@ralia\/ui\/(.*)$/, replacement: resolvePath('../../packages/ui/src/$1') },
      { find: /^@ralia\/ui$/, replacement: resolvePath('../../packages/ui/src/index.ts') },
    ],
  },
  // Keine Sourcemap: Render veroeffentlicht dist vollstaendig, die .map laege
  // damit oeffentlich neben dem Bundle. 'hidden' hilft nicht — die Datei
  // entstuende trotzdem. Der Dev-Server hat davon unabhaengig Sourcemaps.
  build: { outDir: 'dist', sourcemap: false },
  server: { port: 5173 },
});
