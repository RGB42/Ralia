import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const alias = {
  '@ralia/core': resolvePath('./packages/core/src/index.ts'),
  '@ralia/data': resolvePath('./packages/data/src/index.ts'),
  '@ralia/ui': resolvePath('./packages/ui/src/index.ts'),
};

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
