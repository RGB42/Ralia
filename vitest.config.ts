import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Array form with regexes, not the object form: a string alias also replaces the
// prefix of subpath imports, turning '@ralia/ui/tokens/tokens.css' into
// 'packages/ui/src/index.ts/tokens/tokens.css'.
const alias = [
  { find: /^@ralia\/core\/(.*)$/, replacement: resolvePath('./packages/core/src/$1') },
  { find: /^@ralia\/core$/, replacement: resolvePath('./packages/core/src/index.ts') },
  { find: /^@ralia\/data\/(.*)$/, replacement: resolvePath('./packages/data/src/$1') },
  { find: /^@ralia\/data$/, replacement: resolvePath('./packages/data/src/index.ts') },
  { find: /^@ralia\/ui\/(.*)$/, replacement: resolvePath('./packages/ui/src/$1') },
  { find: /^@ralia\/ui$/, replacement: resolvePath('./packages/ui/src/index.ts') },
];

export default defineConfig({
  test: {
    projects: [
      {
        // Domain logic and the data layer are framework-free: plain Node, no DOM.
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          include: [
            'packages/core/src/**/*.test.ts',
            'packages/data/src/**/*.test.ts',
            'packages/ui/src/**/*.test.ts',
          ],
        },
      },
      {
        // Components and app wiring need a DOM.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          globals: true,
          css: true,
          testTimeout: 20_000,
          setupFiles: [resolvePath('./vitest.setup.ts')],
          include: ['packages/ui/src/**/*.test.tsx', 'apps/app/src/**/*.test.{ts,tsx}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts', '**/*.d.ts'],
    },
  },
});
