/**
 * The sheet screen: the open sheet (`state.sheet`), drawn into `#sheet`. Each sheet is a pure component with a
 * selector that reads the session; this screen is the only place that calls the selectors.
 */
import type { JSX } from 'preact';
import { gameMode } from '../../games/registry';
import type { Session } from '../session';
import { AvatarSheet, avatarSheetProps } from './avatar';
import { AwardSheet, awardProps } from './award';
import { BjNowSheet, bjNowProps } from './bj-now';
import { CancelSheet } from './cancel';
import { EndSheet, endProps } from './end';
import { PlayersSheet, playersProps } from './players';
import { SettingsSheet, settingsProps } from './settings';
import { SettleSheet, settleProps } from './settle';

const SHEETS: Record<string, (s: Session) => JSX.Element> = {
  award: s => <AwardSheet {...awardProps(s)} />,
  settle: s => <SettleSheet {...settleProps(s)} />,
  avatar: s => <AvatarSheet {...avatarSheetProps(s)} />,
  bjnow: s => <BjNowSheet {...bjNowProps(s)} />,
  end: s => <EndSheet {...endProps(s)} />,
  cancel: s => <CancelSheet game={gameMode(s.state.room && s.state.room.game)} />,
  players: s => <PlayersSheet {...playersProps(s)} />,
  settings: s => <SettingsSheet {...settingsProps(s)} />,
};

/**
 * The open sheet in its panel. Keyed by the sheet's name: a re-render keeps the panel (and where it is scrolled),
 * opening another sheet starts a fresh one at the top.
 */
export function SheetScreen({ session }: { session: Session }) {
  const name = session.state.sheet || '';
  const draw = Object.prototype.hasOwnProperty.call(SHEETS, name) ? SHEETS[name] : null;
  return (
    <div key={name} class="sheet" role="dialog" aria-modal="true">
      {draw && draw(session)}
    </div>
  );
}
