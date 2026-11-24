import { describe, expect, it } from 'vitest';
import { cacheName, renderSw, shellList, STATIC_SHELL } from './sw-plugin.mts';

describe('service worker file list', () => {
  it('keeps the static shell first and adds the built JS and CSS, sorted', () => {
    const list = shellList(['index.html', 'assets/main-b2.js', 'assets/main-a1.css', 'assets/logo.png', 'sw.js']);
    expect(list).toEqual([...STATIC_SHELL, 'assets/main-a1.css', 'assets/main-b2.js']);
  });

  it('caches the manifest of each language, and the old one for pages from before them', () => {
    expect(STATIC_SHELL).toEqual(
      expect.arrayContaining(['manifest.webmanifest', 'manifest.he.webmanifest', 'manifest.en.webmanifest']),
    );
  });

  it('names the cache after the build', () => {
    const a = cacheName(shellList(['assets/main-1.js']), 'tpl');
    expect(a).toMatch(/^chips-[0-9a-f]{10}$/);
    expect(cacheName(shellList(['assets/main-1.js']), 'tpl')).toBe(a);
    expect(cacheName(shellList(['assets/main-2.js']), 'tpl')).not.toBe(a);
    expect(cacheName(shellList(['assets/main-1.js']), 'tpl2')).not.toBe(a);
  });

  it('fills the template placeholders', () => {
    const out = renderSw('const CACHE = __CACHE__;\nconst SHELL = __SHELL__;', 'chips-x', ['./', 'a.js']);
    expect(out).toBe('const CACHE = "chips-x";\nconst SHELL = ["./","a.js"];');
    expect(() => renderSw('const CACHE = __CACHE__;', 'c', [])).toThrow(/__SHELL__/);
  });
});
