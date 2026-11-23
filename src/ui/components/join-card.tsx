/** Sitting down at a table you opened by code or link, or (Blackjack) the dealer joining as a bettor. */
import { fmt } from '../format';
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
        <span class="muted">אתה הדילר. אם תרצה גם להמר:</span>
        <button class="btn ghost" data-a="sit">
          הצטרפות כמהמר
        </button>
      </div>
    );
  return (
    <div class="card" style="margin-top:14px">
      <span class="label">הצטרפות לשולחן</span>
      <div class="me-row">
        <AvatarButton who={me} />
        <input id="jname" data-bind="name" value={name} maxLength={20} placeholder="השם שלך" />
      </div>
      <button class="btn primary" data-a="sit">
        {`שבו לשולחן עם ${fmt(startStack)} צ'יפים`}
      </button>
      {seated.length > 0 && <span class="muted">כבר ישבתם מטלפון אחר? בחרו את עצמכם:</span>}
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
