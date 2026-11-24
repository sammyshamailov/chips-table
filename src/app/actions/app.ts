/**
 * The app's own controls: the language, the sound switches, installing and updating the app, the ceremony's buttons
 * and the turn-the-phone prompt.
 */
import { asLang, lang, t, type Lang } from '../../i18n';
import { lockLandscape } from '../../ui/rotate';
import type { Updater } from '../../update';
import type { CeremonyPlayer } from '../ceremony';
import type { Actions, AppContext } from '../context';

export interface AppActionDeps {
  updates: Updater;
  ceremony: CeremonyPlayer;
  install(): Promise<void>;
  /** Starts or stops the background sound to match the settings. */
  ambiSync(): void;
  /** Speaks `l` from now on: saved on the phone, the page and the narration follow, everything is drawn again. */
  setLanguage(l: Lang): void;
}

export function appActions(c: AppContext, d: AppActionDeps): Actions {
  const { S, snd } = c;
  return {
    /** The language switch: to the language given (Settings), or the other one (the home screen's switch). */
    lang: v => {
      const next = asLang(v) || (lang() === 'he' ? 'en' : 'he');
      if (next !== lang()) d.setLanguage(next);
    },
    snd: () => {
      const on = snd.toggle();
      c.toast(on ? t('toast.soundOn') : t('toast.soundOff'));
      c.render();
    },
    ambi: () => {
      snd.setAmbi(!snd.ambiOn);
      d.ambiSync();
      c.render();
    },
    voice: () => {
      snd.setVoice(!snd.voiceOn);
      if (!snd.voiceOn) snd.voiceStop();
      d.ambiSync();
      c.render();
    },
    install: () => d.install(),
    reload: () => d.updates.reload(),
    upd: () => d.updates.updateNow(),
    replay: () => d.ceremony.play(),
    finclose: () => {
      d.ceremony.hide();
      c.layer.FX.signDrop = c.now();
      c.render();
      if (S.room && S.room.closed) snd.say('closed');
    },
    rotoff: () => {
      S.rotOff = true;
      c.render();
    },
    rotlock: async () => {
      try {
        await lockLandscape();
      } catch {
        c.toast(t('toast.cantRotate'));
      }
      c.render();
    },
  };
}
