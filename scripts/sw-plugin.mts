// Vite plugin that writes dist/sw.js from src/sw-template.js at build time: the cache list is the real built files
// (hashed names) plus the fixed app shell, and the cache name changes whenever any of them (or the template) changes.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Files cached at install besides the bundle: the same shell the hand-written sw.js listed. */
export const STATIC_SHELL = [
  './',
  'index.html',
  'config.js',
  'manifest.webmanifest',
  'manifest.he.webmanifest',
  'manifest.en.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

/** The install list: the static shell, then every emitted JS/CSS file of the bundle, sorted, without duplicates. */
export function shellList(bundleFiles: string[]): string[] {
  const built = bundleFiles.filter(f => /\.(js|css)$/.test(f) && f !== 'sw.js').sort();
  return [...new Set([...STATIC_SHELL, ...built])];
}

/** A cache name derived from the install list and the template, so a new build gets a new cache. */
export function cacheName(shell: string[], template: string): string {
  const hash = createHash('sha256').update(shell.join('\n')).update('\0').update(template).digest('hex');
  return 'chips-' + hash.slice(0, 10);
}

/** Fills the template's __CACHE__ and __SHELL__ placeholders (each must appear exactly once). */
export function renderSw(template: string, cache: string, shell: string[]): string {
  for (const key of ['__CACHE__', '__SHELL__']) {
    if (template.split(key).length !== 2) throw new Error(`sw template: ${key} must appear exactly once`);
  }
  return template.replace('__CACHE__', () => JSON.stringify(cache)).replace('__SHELL__', () => JSON.stringify(shell));
}

export function swPlugin(templatePath: string): Plugin {
  return {
    name: 'chips-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const template = readFileSync(templatePath, 'utf8');
      const shell = shellList(Object.keys(bundle));
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: renderSw(template, cacheName(shell, template), shell),
      });
    },
  };
}
