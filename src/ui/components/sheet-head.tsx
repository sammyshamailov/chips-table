/** A sheet's title with the close button. */
import { t } from '../../i18n';

export function SheetHead({ title }: { title: string }) {
  return (
    <div class="sheet-head">
      <h2>{title}</h2>
      <button class="btn small ghost" data-a="close">
        {t('common.close')}
      </button>
    </div>
  );
}
