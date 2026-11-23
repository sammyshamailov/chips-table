/**
 * Settings: the invite (code and link), the casino background and the dealer's narration, the version; the dealer
 * also switches the game and changes the limits; anyone else can take over as dealer.
 */
import { GAMES, gameMode, type GameMode } from '../../games/registry';
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
      <span class="label">סוג משחק</span>
      <div class="seg">
        {[GAMES.holdem, GAMES.blackjack].map(x => (
          <button data-a="setgame" data-v={x.id} aria-pressed={x === game} disabled={busy}>
            {x.name}
          </button>
        ))}
      </div>
      {busy && <span class="muted">אפשר להחליף משחק כשאין צ'יפים על השולחן.</span>}
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
      <NumField id="estack" bind="edit.startStack" label="צ'יפים למצטרפים חדשים" value={edit.startStack} />
      <button class="btn primary" data-a="saveset">
        שמירה
      </button>
    </>
  );
}

export function SettingsSheet({ code, game, sound, edit, busy, dealerName, myId, build }: SettingsProps) {
  const off = sound.on ? '' : ' · הצלילים כבויים כרגע';
  return (
    <>
      <SheetHead title="הגדרות" />
      <div class="card" style="padding:12px">
        <span class="muted">שתפו את הקישור לעמוד הזה ואת הקוד</span>
        <div class="row" style="justify-content:space-between">
          <span class="code">{code}</span>
          <button class="btn small" data-a="copy">
            שיתוף הזמנה
          </button>
        </div>
        <span class="muted">
          להתקנה: באנדרואיד, תפריט הדפדפן ← "התקנת אפליקציה". באייפון, ספארי ← שיתוף ← "הוספה למסך הבית".
        </span>
      </div>
      <Option a="ambi" pressed={sound.ambiOn}>
        <b>אווירת קזינו ברקע</b>
        <br />
        <span class="muted">{'מכונות מזל ואנשים מדברים בשקט, מדי פעם' + off}</span>
      </Option>
      <Option a="voice" pressed={sound.voiceOn}>
        <b>קריינות הדילרית</b>
        <br />
        <span class="muted">{'הדילרית אומרת בקול מה קורה: הימורים, קלפים, תשלום' + off}</span>
      </Option>
      {edit ? (
        <DealerSettings game={game} edit={edit} busy={busy} />
      ) : (
        <>
          <span class="muted">{dealerName + ' הוא הדילר. אם הוא עזב, אפשר לקחת את התפקיד.'}</span>
          <button class="btn ghost" data-a="mkhost" data-v={myId}>
            אני הדילר עכשיו
          </button>
        </>
      )}
      <button class="btn ghost" data-a="home">
        יציאה למסך הראשי
      </button>
      <span class="muted num" style="text-align:center">
        {'גרסה ' + (build ? build.slice(0, 7) : 'מקומית')}
      </span>
    </>
  );
}
