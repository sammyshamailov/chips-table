/**
 * The players: everyone's chips; the dealer adds or takes chips (rebuy), adds a player without a phone, gives a
 * break (Hold'em), hands the dealer role over and removes players (with a second tap). You change your picture here.
 */
import { gameMode } from '../../games/registry';
import { SheetHead } from '../components/sheet-head';
import { fmt } from '../format';
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
      {p.sittingOut ? 'חזרה למשחק' : 'הפסקה'}
    </button>
  );
}

function Manage({ p, sitOut, confirm }: { p: PlayerLine; sitOut: boolean; confirm: string | null }) {
  return (
    <>
      <div class="row">
        <input id={'adj-' + p.pid} data-bind={'adj.' + p.pid} inputMode="numeric" value={p.adj} />
        <button class="btn small" data-a="adj" data-v={p.pid + '|1'}>
          הוספה
        </button>
        <button class="btn small ghost" data-a="adj" data-v={p.pid + '|-1'}>
          הורדה
        </button>
      </div>
      <div class="row" style="flex-wrap:wrap">
        {sitOut && <SitOut p={p} />}
        {!p.isDealer && (
          <button class="btn small ghost" data-a="mkhost" data-v={p.pid}>
            העברת דילר
          </button>
        )}
        <button class="btn small danger" data-a="remove" data-v={p.pid}>
          {confirm === p.pid ? 'בטוח? להסיר' : 'הסרה'}
        </button>
      </div>
    </>
  );
}

export function PlayersSheet({ list, host, seated, myId, sitOut, newName, confirm }: PlayersProps) {
  return (
    <>
      <SheetHead title="שחקנים" />
      {seated && (
        <button class="btn ghost" data-a="sheet" data-v="avatar">
          החלפת התמונה שלי
        </button>
      )}
      {host && (
        <span class="muted">
          כאן מוסיפים צ'יפים (ריביי), מורידים, ומעבירים את תפקיד הדילר. אפשר גם להוסיף שחקן בלי טלפון, ואז מנהלים אותו
          מכאן.
        </span>
      )}
      {host && (
        <div class="row">
          <input id="newp" data-bind="newName" value={newName} maxLength={20} placeholder="שם שחקן חדש" />
          <button class="btn small" data-a="addp">
            הוספה
          </button>
        </div>
      )}
      <div class="stack" style="gap:8px">
        {list.length ? (
          list.map(p => (
            <div key={p.pid} class="mgr">
              <div class="row" style="justify-content:space-between">
                <b>{p.name + (p.isDealer ? ' · דילר' : '')}</b>
                <span class="num">{fmt(p.stack)}</span>
              </div>
              {host ? <Manage p={p} sitOut={sitOut} confirm={confirm} /> : p.pid === myId && sitOut && <SitOut p={p} />}
            </div>
          ))
        ) : (
          <span class="muted">אין שחקנים עדיין.</span>
        )}
      </div>
    </>
  );
}
