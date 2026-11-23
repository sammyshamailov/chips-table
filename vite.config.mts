import { defineConfig } from 'vitest/config';
import { swPlugin } from './scripts/sw-plugin.mts';

export default defineConfig({
  // Relative URLs, like the hand-written app had: the site is served from the root, and nothing breaks under a sub-path.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
  plugins: [swPlugin('src/sw-template.js')],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.mts'] },
});
