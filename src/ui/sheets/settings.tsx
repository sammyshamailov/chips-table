/**
 * Settings: the invite (code and link), the casino background and the dealer's narration, the version; the dealer
 * also switches the game and changes the limits; anyone else can take over as dealer.
 */
import { GAMES, gameMode, type GameMode } from '../../games/registry';
import { t } from '../../i18n';
import { LangChoice } from '../components/lang';
import { NumField } from '../components/field';
import { Option } from '../components/option';
import { SheetHead } from '../components/sheet-head';
import type { EditForm, Session } from '../session';

export interface SettingsProps {
  code: string;
  game: GameMode;
  sound: { on: boolean; ambiOn: boolean; voiceOn: boolean };
  /** The dealer's form, or null when you aren't the dealer. */
  edit: EditForm | null;
  /** Chips on the table: the game can't be switched. */
  busy: boolean;
  dealerName: string;
  myId: string;
  /** `APP_BUILD`, or null in a local build. */
  build: string | null;
}

export function settingsProps(s: Session): SettingsProps {
  const S = s.state,
    r = S.room;
  return {
    code: r ? r.code : '',
    game: gameMode(r && r.game),
    sound: s.sound(),
    edit: s.isHost() ? S.edit : null,
    busy: s.chipsOnTable(),
    dealerName: s.nameOf(r ? r.hostId : ''),
    myId: S.myId,
    build: s.build,
  };
}

function DealerSettings({ game, edit, busy }: { game: GameMode; edit: EditForm; busy: boolean }) {
  return (
    <>
      <span class="label">{t('home.gameType')}</span>
      <div class="seg">
        {[GAMES.holdem, GAMES.blackjack].map(x => (
          <button data-a="setgame" data-v={x.id} aria-pressed={x === game} disabled={busy}>
            {x.name}
          </button>
        ))}
      </div>
      {busy && <span class="muted">{t('set.busy')}</span>}
      <div class="grid2">
        {game.limits.map(f => (
          <NumField
            key={f.id}
            id={'e' + f.id}
            bind={'edit.' + f.key}
            label={f.settingsLabel || f.label}
            value={edit[f.key]}
          />
        ))}
      </div>
      <NumField id="estack" bind="edit.startStack" label={t('set.newStack')} value={edit.startStack} />
      <button class="btn primary" data-a="saveset">
        {t('set.save')}
      </button>
    </>
  );
}

export function SettingsSheet({ code, game, sound, edit, busy, dealerName, myId, build }: SettingsProps) {
  const off = sound.on ? '' : ' · ' + t('set.soundsOff');
  return (
    <>
      <SheetHead title={t('room.settings')} />
      <div class="card" style="padding:12px">
        <span class="muted">{t('set.share')}</span>
        <div class="row" style="justify-content:space-between">
          <span class="code">{code}</span>
          <button class="btn small" data-a="copy">
            {t('set.invite')}
          </button>
        </div>
        <span class="muted">{t('set.install')}</span>
      </div>
      <Option a="ambi" pressed={sound.ambiOn}>
        <b>{t('set.ambi')}</b>
        <br />
        <span class="muted">{t('set.ambiNote') + off}</span>
      </Option>
      <Option a="voice" pressed={sound.voiceOn}>
        <b>{t('set.voice')}</b>
        <br />
        <span class="muted">{t('set.voiceNote') + off}</span>
      </Option>
      <LangChoice />
      {edit ? (
        <DealerSettings game={game} edit={edit} busy={busy} />
      ) : (
        <>
          <span class="muted">{t('set.dealerIs', { name: dealerName })}</span>
          <button class="btn ghost" data-a="mkhost" data-v={myId}>
            {t('set.takeOver')}
          </button>
        </>
      )}
      <button class="btn ghost" data-a="home">
        {t('set.leave')}
      </button>
      <span class="muted num" style="text-align:center">
        {build ? t('set.version', { v: build.slice(0, 7) }) : t('set.localVersion')}
      </span>
    </>
  );
}
