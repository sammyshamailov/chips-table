/**
 * Inside a table: loading, not found, the update screen (R-009), or the room. The room is a side panel (header,
 * status lines, join card, dealer controls or the final card, your dock) and the table; in portrait the side panel's
 * parts are laid out around the table by CSS order. The table, the dock and the dealer controls are the game's
 * components (`GameMode.views`: Blackjack since Part B), or still HTML strings from src/legacy.ts (`LegacyParts`,
 * Hold'em until Part C).
 */
import { tableUnsupported } from '../../domain/guard';
import { gameMode } from '../../games/registry';
import { FinalCard } from '../components/final-card';
import { RoomHeader } from '../components/header';
import { JoinCard } from '../components/join-card';
import { ModeBanner } from '../components/mode-banner';
import { LegacyHtml } from '../legacy-html';
import type { LegacyParts, Session } from '../session';
import { UpdateView } from './update';

function NotFound({ code }: { code: string }) {
  return (
    <div class="stack" style="padding-top:40px">
      <div class="card">
        <h2 style="font-family:var(--f-display);font-size:36px">{`החדר ${code} לא נמצא`}</h2>
        <span class="muted">בדקו את הקוד ונסו שוב.</span>
        <button class="btn primary" data-a="home">
          חזרה
        </button>
      </div>
    </div>
  );
}

export function RoomScreen({ session, legacy }: { session: Session; legacy: LegacyParts | null }) {
  const S = session.state,
    r = S.room,
    code = S.code || '';
  if (!S.roomLoaded) return <div class="spin">טוען את השולחן…</div>;
  if (!r) return <NotFound code={code} />;
  if (tableUnsupported(r) || !legacy) return <UpdateView code={code} />;
  const g = gameMode(r.game),
    v = g.views,
    m = session.me(),
    host = session.isHost(),
    closed = !!r.closed,
    stage = g.fitStage ? 'stage fit' : 'stage';
  return (
    <div class="room">
      <div class="side">
        <RoomHeader
          code={r.code}
          gameName={g.name}
          conn={{ mode: S.mode, syncErr: S.syncErr, synced: !!(S.synced && S.pSynced) }}
          soundOn={session.sound().on}
        />
        {(S.mode !== 'cloud' || S.readOnly) && (
          <div class="mb" style="margin-bottom:12px">
            <ModeBanner mode={S.mode} />
          </div>
        )}
        {session.newBuild() && (
          <div class="updw">
            <button class="btn primary wide" data-a="reload">
              יש גרסה חדשה · לחצו לעדכון
            </button>
          </div>
        )}
        <div class="event">{r.lastEvent ? r.lastEvent.t : ''}</div>
        {!m && !closed && (
          <div class="o-join">
            <JoinCard
              dealerIsHouse={host && g.dealerIsHouse}
              me={session.myAvatar()}
              name={S.name}
              startStack={r.startStack}
              seated={session.players()}
            />
          </div>
        )}
        {host &&
          !closed &&
          (v ? (
            <div class="o-host">
              <v.HostPanel session={session} />
            </div>
          ) : (
            <LegacyHtml class="o-host" html={legacy.host || ''} />
          ))}
        {session.looksClosed() && (
          <div class="o-host">
            <FinalCard list={r.final ? r.final.list : []} players={S.players} canReopen={host} />
          </div>
        )}
        {hasDock(session) && (
          <div class="dock">
            {v ? (
              <div class="dock-in">
                <v.Dock session={session} />
              </div>
            ) : (
              <LegacyHtml class="dock-in" html={legacy.dock || ''} />
            )}
          </div>
        )}
      </div>
      {v ? (
        <div class={stage}>
          <v.Table session={session} />
        </div>
      ) : (
        <LegacyHtml class={stage} html={legacy.table || ''} />
      )}
    </div>
  );
}

/** You sit at the table and it is open: your controls are at the bottom (the side panel in landscape). */
const hasDock = (session: Session) => !!session.me() && !session.state.room?.closed;

/**
 * The class of `#app` for this screen: `in-room` (and `has-dock`) inside a table, nothing on home and on the update
 * screen, and null (leave it as it is) while a table loads or wasn't found, as the string views always did.
 */
export function appClass(session: Session, legacy: LegacyParts | null): string | null {
  const S = session.state;
  if (!S.code) return '';
  if (!S.roomLoaded || !S.room) return null;
  if (tableUnsupported(S.room) || !legacy) return '';
  return 'in-room' + (hasDock(session) ? ' has-dock' : '');
}
