/** The "closed" sign hanging over a table once the game has ended; it drops in just after the ceremony. */
import { t } from '../../i18n';

export function ClosedSign({ drop }: { drop: boolean }) {
  return (
    <div class={'csign' + (drop ? ' drop' : '')} aria-label={t('closed.sign')}>
      <span>{t('closed.sign')}</span>
    </div>
  );
}
