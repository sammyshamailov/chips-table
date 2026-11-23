/** The home screen: your name and picture, join a table by code or from the list, open a new table. */
import type { Room } from '../../data/schema';
import { tableUnsupported } from '../../domain/guard';
import { GAMES, gameMode } from '../../games/registry';
import { AvatarButton } from '../components/avatar';
import { NumField } from '../components/field';
import { ModeBanner } from '../components/mode-banner';
import type { CreateForm, Session } from '../session';

/** The open tables (the last few with activity), or nothing when there are none. */
export function RoomsList({ rooms }: { rooms: Room[] }) {
  return (
    <div id="roomsList" class="rooms">
      {rooms.length > 0 && <span class="muted">שולחנות פעילים</span>}
      {rooms.map(r => (
        <button key={r.code} class="roomrow" data-a="open" data-v={r.code}>
          <span>
            <span class="code">{r.code}</span>
          </span>
          {tableUnsupported(r) ? (
            <span class="muted">צריך עדכון</span>
          ) : (
            <span class="muted">{`${gameMode(r.game).listName} · ${r.lastEvent ? r.lastEvent.t : ''}`}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** A new table: the game, chips per player, its limits, and whether the dealer plays too. */
export function CreateCard({ form }: { form: CreateForm }) {
  const g = gameMode(form.game);
  return (
    <div class="card">
      <span class="label">שולחן חדש</span>
      <div class="seg" role="group" aria-label="סוג משחק">
        {[GAMES.holdem, GAMES.blackjack].map(x => (
          <button data-a="cgame" data-v={x.id} aria-pressed={x === g}>
            {x.name}
          </button>
        ))}
      </div>
      <NumField id="cstack" bind="create.stack" label="צ'יפים לכל שחקן" value={form.stack} />
      <div class="grid2">
        {g.limits.map(f => (
          <NumField key={f.id} id={'c' + f.id} bind={'create.' + f.key} label={f.label} value={form[f.key]} />
        ))}
      </div>
      <label class="check">
        <input type="checkbox" id="cplay" data-bind="create.play" checked={form.play} />
        {' ' + g.playLabel}
      </label>
      <button class="btn primary wide" data-a="create">
        פתיחת שולחן
      </button>
      <span class="muted">מי שפותח את השולחן הוא הדילר: מתחיל ידיים, מקדם רחובות ומחלק את הקופה לזוכים.</span>
    </div>
  );
}

export function Home({ session }: { session: Session }) {
  const S = session.state;
  return (
    <>
      <header class="brand">
        <h1>
          צ'יפים<span>.</span>
        </h1>
        <p>הקלפים אמיתיים, הצ'יפים כאן. כל אחד מהטלפון שלו.</p>
      </header>
      <div class="stack">
        {session.installAvailable() && (
          <button class="btn ghost wide" data-a="install">
            התקנת האפליקציה בטלפון
          </button>
        )}
        <ModeBanner mode={S.mode} />
        <div class="card">
          <div class="me-row">
            <AvatarButton who={session.myAvatar()} />
            <label class="field">
              <span class="label">השם שלך</span>
              <input
                id="name"
                data-bind="name"
                value={S.name}
                maxLength={20}
                placeholder="למשל: סמי"
                autocomplete="nickname"
              />
            </label>
          </div>
        </div>
        <div class="card">
          <span class="label">הצטרפות לשולחן</span>
          <div class="row">
            <input
              id="jcode"
              data-bind="joinCode"
              value={S.joinCode}
              maxLength={4}
              placeholder="קוד חדר"
              style="direction:ltr;text-align:center;letter-spacing:6px;font-weight:700;text-transform:uppercase"
            />
            <button class="btn primary" data-a="join">
              הצטרפות
            </button>
          </div>
          <RoomsList rooms={S.rooms} />
        </div>
        <CreateCard form={S.create} />
      </div>
    </>
  );
}
