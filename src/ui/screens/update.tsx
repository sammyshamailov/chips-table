/** A table opened by a newer version of the app (R-009): update to join it, or go home. Nothing else acts here. */
import { t } from '../../i18n';

export function UpdateView({ code }: { code: string }) {
  return (
    <div class="stack" style="padding-top:40px">
      <div class="card" id="needupd">
        <h2 style="font-family:var(--f-display);font-size:34px">{t('upd.title')}</h2>
        <span class="muted">{t('upd.text', { code })}</span>
        <button class="btn primary wide" data-a="upd">
          {t('upd.update')}
        </button>
        <button class="btn ghost wide" data-a="home">
          {t('common.backHome')}
        </button>
      </div>
    </div>
  );
}
