/** The home screen: your name and picture, join a table by code or from the list, open a new table. */
import type { Room } from '../../data/schema';
import { tableUnsupported } from '../../domain/guard';
import { GAMES, gameMode } from '../../games/registry';
import { eventText, t } from '../../i18n';
import { AvatarButton } from '../components/avatar';
import { NumField } from '../components/field';
import { LangSwitch } from '../components/lang';
import { ModeBanner } from '../components/mode-banner';
import type { CreateForm, Session } from '../session';

/** The open tables (the last few with activity), or nothing when there are none. */
export function RoomsList({ rooms }: { rooms: Room[] }) {
  return (
    <div id="roomsList" class="rooms">
      {rooms.length > 0 && <span class="muted">{t('home.active')}</span>}
      {rooms.map(r => (
        <button key={r.code} class="roomrow" data-a="open" data-v={r.code}>
          <span>
            <span class="code">{r.code}</span>
          </span>
          {tableUnsupported(r) ? (
            <span class="muted">{t('home.needsUpdate')}</span>
          ) : (
            <span class="muted">{`${gameMode(r.game).listName} · ${eventText(r.lastEvent)}`}</span>
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
      <span class="label">{t('home.newTable')}</span>
      <div class="seg" role="group" aria-label={t('home.gameType')}>
        {[GAMES.holdem, GAMES.blackjack].map(x => (
          <button data-a="cgame" data-v={x.id} aria-pressed={x === g}>
            {x.name}
          </button>
        ))}
      </div>
      <NumField id="cstack" bind="create.stack" label={t('home.stack')} value={form.stack} />
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
        {t('home.open')}
      </button>
      <span class="muted">{t('home.dealerNote')}</span>
    </div>
  );
}

export function Home({ session }: { session: Session }) {
  const S = session.state;
  return (
    <>
      <header class="brand">
        <h1>
          {t('app.name')}
          <span>.</span>
        </h1>
        <p>{t('app.tagline')}</p>
        <LangSwitch />
      </header>
      <div class="stack">
        {session.installAvailable() && (
          <button class="btn ghost wide" data-a="install">
            {t('home.install')}
          </button>
        )}
        <ModeBanner mode={S.mode} />
        <div class="card">
          <div class="me-row">
            <AvatarButton who={session.myAvatar()} />
            <label class="field">
              <span class="label">{t('common.yourName')}</span>
              <input
                id="name"
                data-bind="name"
                value={S.name}
                maxLength={20}
                placeholder={t('home.namePlaceholder')}
                autocomplete="nickname"
              />
            </label>
          </div>
        </div>
        <div class="card">
          <span class="label">{t('home.join')}</span>
          <div class="row">
            <input
              id="jcode"
              data-bind="joinCode"
              value={S.joinCode}
              maxLength={4}
              placeholder={t('home.code')}
              style="direction:ltr;text-align:center;letter-spacing:6px;font-weight:700;text-transform:uppercase"
            />
            <button class="btn primary" data-a="join">
              {t('home.joinBtn')}
            </button>
          </div>
          <RoomsList rooms={S.rooms} />
        </div>
        <CreateCard form={S.create} />
      </div>
    </>
  );
}
