import { defineConfig } from 'vitest/config';
import { swPlugin } from './scripts/sw-plugin.mts';

export default defineConfig({
  // Relative URLs, like the hand-written app had: the site is served from the root, and nothing breaks under a sub-path.
  base: './',
  // No single-page fallback: a missing file (config.js in single-device mode) is a 404, as on Netlify, not index.html.
  appType: 'mpa',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [swPlugin('src/sw-template.js')],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mts'],
    // `npm run coverage`: the game rules are the code that must be fully tested.
    coverage: { provider: 'v8', include: ['src/domain/**/*.ts'], exclude: ['src/**/*.test.ts'], reporter: ['text'] },
  },
});
