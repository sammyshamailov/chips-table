/** Connecting, or single-device mode (no Firebase config): a banner on the home screen and in the room. */
import { t } from '../../i18n';

export function ModeBanner({ mode }: { mode: string }) {
  if (mode === 'pending') return <div class="banner">{t('mode.connecting')}</div>;
  if (mode === 'local')
    return (
      <div class="banner">
        <b>{t('mode.local')}</b>
        <span class="muted">{t('mode.localText')}</span>
        <button class="btn small ghost" data-a="retry">
          {t('mode.retry')}
        </button>
      </div>
    );
  return null;
}
