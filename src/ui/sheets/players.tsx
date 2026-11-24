/**
 * The players: everyone's chips; the dealer adds or takes chips (rebuy), adds a player without a phone, gives a
 * break (Hold'em), hands the dealer role over and removes players (with a second tap). You change your picture here.
 */
import { gameMode } from '../../games/registry';
import { formatChips, t } from '../../i18n';
import { SheetHead } from '../components/sheet-head';
import type { Session } from '../session';

interface PlayerLine {
  pid: string;
  name: string;
  stack: number;
  isDealer: boolean;
  sittingOut: boolean;
  /** The amount in the dealer's field. */
  adj: string;
}

export interface PlayersProps {
  list: PlayerLine[];
  /** You are the dealer (the management controls show). */
  host: boolean;
  seated: boolean;
  myId: string;
  sitOut: boolean;
  newName: string;
  /** The player whose remove button waits for the second tap. */
  confirm: string | null;
}

export function playersProps(s: Session): PlayersProps {
  const S = s.state,
    r = S.room;
  return {
    list: s.players().map(p => ({
      pid: p.pid,
      name: p.name,
      stack: p.stack,
      isDealer: !!r && r.hostId === p.pid,
      sittingOut: !!p.sittingOut,
      adj: String(S.adj[p.pid] ?? (r ? r.startStack : '')),
    })),
    host: s.isHost(),
    seated: !!s.me(),
    myId: S.myId,
    sitOut: gameMode(r && r.game).sitOut,
    newName: S.newName,
    confirm: S.confirm,
  };
}

function SitOut({ p }: { p: PlayerLine }) {
  return (
    <button class="btn small ghost" data-a="sitout" data-v={p.pid}>
      {p.sittingOut ? t('players.backIn') : t('players.break')}
    </button>
  );
}

function Manage({ p, sitOut, confirm }: { p: PlayerLine; sitOut: boolean; confirm: string | null }) {
  return (
    <>
      <div class="row">
        <input id={'adj-' + p.pid} data-bind={'adj.' + p.pid} inputMode="numeric" value={p.adj} />
        <button class="btn small" data-a="adj" data-v={p.pid + '|1'}>
          {t('common.add')}
        </button>
        <button class="btn small ghost" data-a="adj" data-v={p.pid + '|-1'}>
          {t('players.take')}
        </button>
      </div>
      <div class="row" style="flex-wrap:wrap">
        {sitOut && <SitOut p={p} />}
        {!p.isDealer && (
          <button class="btn small ghost" data-a="mkhost" data-v={p.pid}>
            {t('players.makeDealer')}
          </button>
        )}
        <button class="btn small danger" data-a="remove" data-v={p.pid}>
          {confirm === p.pid ? t('players.removeSure') : t('players.remove')}
        </button>
      </div>
    </>
  );
}

export function PlayersSheet({ list, host, seated, myId, sitOut, newName, confirm }: PlayersProps) {
  return (
    <>
      <SheetHead title={t('room.players')} />
      {seated && (
        <button class="btn ghost" data-a="sheet" data-v="avatar">
          {t('players.myPhoto')}
        </button>
      )}
      {host && <span class="muted">{t('players.help')}</span>}
      {host && (
        <div class="row">
          <input id="newp" data-bind="newName" value={newName} maxLength={20} placeholder={t('players.newName')} />
          <button class="btn small" data-a="addp">
            {t('common.add')}
          </button>
        </div>
      )}
      <div class="stack" style="gap:8px">
        {list.length ? (
          list.map(p => (
            <div key={p.pid} class="mgr">
              <div class="row" style="justify-content:space-between">
                <b>{p.isDealer ? t('common.nameDealer', { name: p.name }) : p.name}</b>
                <span class="num">{formatChips(p.stack)}</span>
              </div>
              {host ? <Manage p={p} sitOut={sitOut} confirm={confirm} /> : p.pid === myId && sitOut && <SitOut p={p} />}
            </div>
          ))
        ) : (
          <span class="muted">{t('players.none')}</span>
        )}
      </div>
    </>
  );
}
