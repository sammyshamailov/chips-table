/**
 * The session the screens read (`Session`, src/ui/session.ts): the state and the questions screens ask about it,
 * answered from the state, the rules and the effects layer.
 */
import type { Sound } from '../audio/synth';
import * as BJ from '../domain/blackjack/rules';
import { computeAward } from '../domain/holdem/pots';
import type { FxLayer } from '../fx/layer';
import type { Session } from '../ui/session';
import type { Updater } from '../update';
import { holdem, isHost, me, nameOf, pendChips, playerList, roomDenoms, standings, type State } from './state';

/** How long after the ceremony the closed sign is still dropping in. */
const SIGN_DROP_MS = 1800;

export interface SessionDeps {
  S: State;
  layer: FxLayer;
  snd: Sound;
  updates: Updater;
  installAvailable(): boolean;
  now(): number;
}

export function createSession({ S, layer, snd, updates, installAvailable, now }: SessionDeps): Session {
  const FX = layer.FX;
  return {
    state: S,
    fx: {
      ov: layer.ov,
      shownStack: p => layer.shownStack(p) as number,
      ghost: () => {
        const c = pendChips(S);
        return c.slice(0, Math.max(0, c.length - FX.pendFly));
      },
      signDrop: () => !!(FX.signDrop && now() - FX.signDrop < SIGN_DROP_MS),
    },
    denoms: () => roomDenoms(S),
    me: () => me(S),
    players: () => playerList(S),
    isHost: () => isHost(S),
    nameOf: id => nameOf(S, id),
    myAvatar: () => ({ pid: S.myId, name: S.name || '?', avatar: S.avatar }),
    standings: () => standings(S),
    looksClosed: () => !!(S.room && S.room.closed && !FX.cer),
    holdem: () => holdem(S),
    award: sel => computeAward(holdem(S), sel),
    bjCurrent: p => BJ.isCurrent(p, S.room),
    bjEligible: p => BJ.blackjackEligible(p, S.room),
    chipsOnTable: () =>
      S.room && S.room.game === 'holdem' ? holdem(S).pot > 0 : playerList(S).some(p => BJ.isCurrent(p, S.room)),
    installAvailable,
    newBuild: updates.newBuild,
    build: updates.build,
    sound: () => ({ on: snd.on, ambiOn: snd.ambiOn, voiceOn: snd.voiceOn }),
  };
}
