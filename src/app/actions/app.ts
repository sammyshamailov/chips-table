/**
 * The app's own controls: the sound switches, installing and updating the app, the ceremony's buttons and the
 * turn-the-phone prompt.
 */
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
}

export function appActions(c: AppContext, d: AppActionDeps): Actions {
  const { S, snd } = c;
  return {
    snd: () => {
      const on = snd.toggle();
      c.toast(on ? 'הצלילים פועלים' : 'הצלילים כבויים');
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
        c.toast('הטלפון לא מאפשר לסובב מכאן. סובבו אותו ביד.');
      }
      c.render();
    },
  };
}
