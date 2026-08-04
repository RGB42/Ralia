import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      // Referenzcode, nicht Teil des Builds: React-Native-Quellen des
      // vorherigen Anlaufs. Sie kompilieren hier nicht und sollen es nicht.
      'docs/native-rebuild-reference/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      // The domain layer must stay honest about its types.
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react-router-dom',
          message:
            'react-router-dom ist in v8 aufgeloest — aus react-router importieren. ' +
            'Achtung: der Name bleibt aus dem Hauptcheckout aufloesbar und wuerde still ' +
            'die verwundbare 7.18.2 laden (GHSA-qwww-vcr4-c8h2).',
        }],
      }],
    },
  },
  {
    files: ['packages/ui/**/*.tsx', 'apps/app/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Node-Skripte sind kein TypeScript, der Block oben greift also nicht —
    // ohne diese Globals meldet no-undef hier URL, process und console.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'scripts/**/*.mjs', 'vitest.setup.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
