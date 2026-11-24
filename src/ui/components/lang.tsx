/**
 * The language switch on the home screen's top corner: "EN / HE" (each in its own script), the language in use brighter. Each name comes
 * from its own catalog. A tap switches to the other language (`lang`); Settings has the same choice as two buttons.
 */
import { LANGS, lang, t, tIn } from '../../i18n';

export function LangSwitch() {
  const now = lang();
  return (
    <button class="lang-btn" data-a="lang" aria-label={t('lang.change')} dir="ltr">
      {[...LANGS].reverse().map((l, i) => (
        <>
          {i > 0 && <i>/</i>}
          <span lang={l} class={l === now ? 'on' : undefined}>
            {tIn(l, 'lang.short')}
          </span>
        </>
      ))}
    </button>
  );
}

/** The language choice in Settings: each language under its own name. */
export function LangChoice() {
  const now = lang();
  return (
    <>
      <span class="label">{t('lang.label')}</span>
      <div class="seg" role="group" aria-label={t('lang.label')}>
        {LANGS.map(l => (
          <button data-a="lang" data-v={l} aria-pressed={l === now} lang={l}>
            {tIn(l, 'lang.name')}
          </button>
        ))}
      </div>
    </>
  );
}
