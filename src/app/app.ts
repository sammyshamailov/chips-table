/**
 * The app: the state, the room session, the actions and the screens' render, put together around what `main.ts`
 * created (the storage, the event bus, the sound engine, the effects layer and the mounted screens). Creating it
 * renders nothing, listens to nothing and touches no store; `start()` does that (CLAUDE.md rule 2).
 */
import type { Sound } from '../audio/synth';
import type { KeyValueStore } from '../data/browser-storage';
import { createWriter } from '../data/writes';
import { tableUnsupported } from '../domain/guard';
import { setLang, t, type Lang } from '../i18n';
import { applyLang } from '../i18n/document';
import type { FxLayer } from '../fx/layer';
import type { DomainEvent } from '../sync/domain-events';
import type { EventBus } from '../sync/events';
import { createRoomSession } from '../sync/room-session';
import type { Ui } from '../ui/app';
import { unlockTurn } from '../ui/rotate';
import { createTableScale } from '../ui/scale';
import { createUpdater } from '../update';
import { appActions } from './actions/app';
import { avatarActions, listenPhotoInputs } from './actions/avatar';
import { blackjackActions } from './actions/blackjack';
import { chipActions } from './actions/chips';
import { holdemActions } from './actions/holdem';
import { lobbyActions } from './actions/lobby';
import { tableActions } from './actions/table';
import { createCeremony } from './ceremony';
import type { AppContext } from './context';
import { buzz, createInstallPrompt, createWakeLock } from './device';
import { listenDom } from './dom-events';
import { newPlayerId } from './ids';
import { createNavigation } from './navigation';
import { createRenderer } from './render';
import { createSession } from './session';
import { createState } from './state';

export interface AppDeps {
  bus: EventBus<DomainEvent>;
  snd: Sound;
  layer: FxLayer;
  storage: KeyValueStore;
  ambiSync(): void;
  ui: Ui;
}

/** What `main.ts` gets back. */
export interface App {
  /** Connects, then enters the last table or draws home. Once, after the event subscribers are wired. */
  start(): void;
  render(): void;
  /** Plays the end-of-game ceremony (on the `GameEnded` event). */
  ceremony(): void;
  myId(): string;
  /** Inside a table that is still open (the background sound plays only there). */
  inTable(): boolean;
}

/** An element of the page's shell (index.html). */
const el = (id: string) => document.getElementById(id) as HTMLElement;

export function createApp({ bus, snd, layer, storage, ambiSync, ui }: AppDeps): App {
  const now = () => Date.now();
  const S = createState(storage, newPlayerId);
  const FX = layer.FX;
  const sheetEl = el('sheet'),
    rotEl = el('rot');
  // The renderer is made further down, from what it draws; nothing calls these before start().
  const render = () => renderer.render();
  const paint = () => renderer.paint();
  const toast = (t: string) => ui.toast(t);

  // One write at a time per document (src/data/writes.ts). Never writes to a table this build doesn't understand.
  const writer = createWriter({
    store: () => S.db as NonNullable<typeof S.db>,
    onError: e => writeFailed(toast, e),
    refuse: path =>
      !!(
        S.code &&
        S.room &&
        tableUnsupported(S.room) &&
        (path === 'rooms/' + S.code || path.startsWith('rooms/' + S.code + '/'))
      ),
  });
  const c: AppContext = {
    S,
    storage,
    snd,
    layer,
    write: writer.write,
    inc: writer.inc,
    render,
    paint,
    toast,
    now,
    buzz,
  };

  const updates = createUpdater({
    build: window.APP_BUILD || null,
    render,
    toast,
    idle: () =>
      !S.pending &&
      !S.sheet &&
      !Object.keys(FX.ov).length &&
      !(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)),
  });
  const install = createInstallPrompt({ onHome: () => !S.code, render, toast });
  const wakeLock = createWakeLock(() => !!S.code);
  const scale = createTableScale(el('app'), () => !!S.code);
  const ceremony = createCeremony({ S, el: el('fin'), layer, snd, render });
  const session = createSession({ S, layer, snd, updates, installAvailable: install.available, now });
  const renderer = createRenderer({ S, layer, ui, session, scale, rotEl, ambiSync, updates });

  const roomSession = createRoomSession({
    S,
    bus,
    render,
    paint,
    toast,
    now,
    reenter: code => nav.enter(code),
  });
  const nav = createNavigation(c, {
    session: roomSession,
    hideCeremony: ceremony.hide,
    wake: wakeLock.wake,
    unlockTurn,
  });

  /** Switches the language: the phone remembers it, the page and the narration follow, and every screen is redrawn. */
  function setLanguage(l: Lang): void {
    setLang(l);
    storage.set('chips.lang', l);
    applyLang(document, l);
    snd.voiceLoad();
    render();
  }

  const actions = {
    ...lobbyActions(c, nav),
    ...tableActions(c),
    ...chipActions(c),
    ...holdemActions(c),
    ...blackjackActions(c),
    ...avatarActions(c),
    ...appActions(c, { updates, ceremony, install: install.install, ambiSync, setLanguage }),
  };

  return {
    start() {
      scale.start(() => (S.code ? render() : scale.apply()));
      updates.start();
      listenPhotoInputs(c);
      wakeLock.start();
      install.start();
      listenDom({ S, actions, storage, snd, sheetEl, rotEl, render, paint });
      nav.connectStore();
      render();
    },
    render,
    ceremony: ceremony.play,
    myId: () => S.myId,
    inTable: () => !!(S.code && S.room && !S.room.closed),
  };
}

/** A failed write as a toast, by Firestore's error code. */
function writeFailed(toast: (t: string) => void, e: unknown): void {
  const code = e && (e as { code?: string }).code;
  if (code === 'permission-denied') toast(t('toast.writeDenied'));
  else if (code === 'resource-exhausted') toast(t('toast.quota'));
  else if (code === 'not-found') toast(t('toast.gone'));
  else toast(t('toast.writeFailed'));
}
