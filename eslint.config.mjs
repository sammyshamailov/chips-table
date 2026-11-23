// ESLint flat config: typescript-eslint's recommended rules for the new code.
// src/legacy.ts (the original app script, moved unchanged in R-005 phase 1) and the Playwright scripts in tests/ are
// not linted yet; later phases take the legacy code apart into linted modules.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const IMPURE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'location',
  'history',
  'fetch',
  'firebase',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'queueMicrotask',
  'AudioContext',
  'crypto',
];

// One block per folder depth, because the import rule matches the specifier as written: from src/domain/x.ts the
// way out is '../', from src/domain/holdem/x.ts it is '../../'. Packages are refused too (tests may import vitest).
function domainPurity() {
  const restrictions = (up, tests) => ({
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: [up + '*'], message: 'src/domain/ may only import from src/domain/.' },
          ...(tests ? [] : [{ regex: '^[^.]', message: 'src/domain/ uses no packages.' }]),
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      ...IMPURE_GLOBALS.map(name => ({ name, message: 'src/domain/ is pure: pass it in.' })),
    ],
    'no-restricted-properties': [
      'error',
      { object: 'Date', property: 'now', message: 'Pass `now` in.' },
      { object: 'Math', property: 'random', message: 'Pass randomness in.' },
    ],
    'no-restricted-syntax': ['error', { selector: "NewExpression[callee.name='Date']", message: 'Pass `now` in.' }],
  });
  return [
    { files: ['src/domain/*.ts'], rules: restrictions('../', false) },
    { files: ['src/domain/*/*.ts'], rules: restrictions('../../', false) },
    { files: ['src/domain/*.test.ts'], rules: restrictions('../', true) },
    { files: ['src/domain/*/*.test.ts'], rules: restrictions('../../', true) },
  ];
}

// src/sync/ turns documents into events: pure like the domain (no DOM, timers, clock or randomness), and it may import
// only the domain and itself, so the same documents give the same events on every phone.
function syncPurity() {
  const rules = tests => ({
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../*', '!../domain', '!../domain/**'],
            message: 'src/sync/ may only import from src/domain/ and src/sync/.',
          },
          ...(tests ? [] : [{ regex: '^[^.]', message: 'src/sync/ uses no packages.' }]),
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      ...IMPURE_GLOBALS.map(name => ({ name, message: 'src/sync/ is pure: pass it in.' })),
    ],
    'no-restricted-properties': [
      'error',
      { object: 'Date', property: 'now', message: 'Pass `now` in.' },
      { object: 'Math', property: 'random', message: 'Pass randomness in.' },
    ],
  });
  return [
    { files: ['src/sync/*.ts'], rules: rules(false) },
    { files: ['src/sync/*.test.ts'], rules: rules(true) },
  ];
}

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'src/legacy.ts', 'tests/', 'config.js', 'config.example.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  {
    files: ['src/sw-template.js'],
    languageOptions: { globals: { ...globals.serviceworker, __CACHE__: 'readonly', __SHELL__: 'readonly' } },
  },
  // The domain (src/domain/) is pure game rules: no DOM, no Firebase, no timers, no clock, nothing outside src/domain/.
  ...domainPurity(),
  ...syncPurity(),
  { files: ['vite.config.mts', 'scripts/**/*.mts', 'eslint.config.mjs'], languageOptions: { globals: globals.node } },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
