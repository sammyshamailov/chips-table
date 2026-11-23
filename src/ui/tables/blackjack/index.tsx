/**
 * The Blackjack parts of the room screen, registered in src/games/registry.ts: each reads the session through its
 * selector (select.ts) and draws a pure component.
 */
import type { GameViews } from '../../../games/registry';
import { BlackjackDock } from '../../docks/blackjack';
import { BlackjackHost } from '../../host/blackjack';
import { blackjackDockProps, blackjackHostProps, blackjackTableProps } from './select';
import { BlackjackTable } from './table';

export const blackjackViews: GameViews = {
  Table: ({ session }) => <BlackjackTable {...blackjackTableProps(session)} />,
  Dock: ({ session }) => <BlackjackDock {...blackjackDockProps(session)} />,
  HostPanel: ({ session }) => <BlackjackHost {...blackjackHostProps(session)} />,
};
