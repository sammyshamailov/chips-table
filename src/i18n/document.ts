/**
 * The page follows the language: `<html lang dir>`, the tab's title, and the installed app's name (the manifest and
 * the iPhone's `apple-mobile-web-app-title`). Called by `main.ts` before the first render (so nothing is drawn in the
 * wrong direction) and again when the player switches.
 */
import { dirOf, t, type Lang } from './index';

export function applyLang(doc: Document, l: Lang): void {
  const html = doc.documentElement;
  html.lang = l;
  html.dir = dirOf(l);
  doc.title = t('app.title');
  const manifest = doc.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifest) manifest.setAttribute('href', `manifest.${l}.webmanifest`);
  const apple = doc.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (apple) apple.content = t('app.name');
}
