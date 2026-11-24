/** Sitting down at a table you opened by code or link, or (Blackjack) the dealer joining as a bettor. */
import { t } from '../../i18n';
import type { AvatarOwner } from '../session';
import { AvatarButton } from './avatar';

interface JoinCardProps {
  /** You opened this Blackjack table: you are the house, and may also bet. */
  dealerIsHouse: boolean;
  me: AvatarOwner;
  name: string;
  startStack: number;
  /** The players already seated, to take over your own seat from another phone. */
  seated: { pid: string; name: string }[];
}

export function JoinCard({ dealerIsHouse, me, name, startStack, seated }: JoinCardProps) {
  if (dealerIsHouse)
    return (
      <div class="card" style="margin-top:14px">
        <span class="muted">{t('join.houseNote')}</span>
        <button class="btn ghost" data-a="sit">
          {t('join.asBettor')}
        </button>
      </div>
    );
  return (
    <div class="card" style="margin-top:14px">
      <span class="label">{t('join.title')}</span>
      <div class="me-row">
        <AvatarButton who={me} />
        <input id="jname" data-bind="name" value={name} maxLength={20} placeholder={t('common.yourName')} />
      </div>
      <button class="btn primary" data-a="sit">
        {t('join.sit', { amt: startStack })}
      </button>
      {seated.length > 0 && <span class="muted">{t('join.claimHint')}</span>}
      {seated.length > 0 && (
        <div class="btns">
          {seated.map(p => (
            <button key={p.pid} class="btn small ghost" data-a="claim" data-v={p.pid}>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
