// ESLint flat config: typescript-eslint's recommended rules for the new code.
// src/legacy.ts (the original app script, moved unchanged in R-005 phase 1) and the Playwright scripts in tests/ are
// not linted yet; later phases take the legacy code apart into linted modules.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'src/legacy.ts', 'tests/', 'config.js', 'config.example.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  {
    files: ['src/sw-template.js'],
    languageOptions: { globals: { ...globals.serviceworker, __CACHE__: 'readonly', __SHELL__: 'readonly' } },
  },
  { files: ['vite.config.mts', 'scripts/**/*.mts', 'eslint.config.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
