/**
 * The Hold'em parts of the room screen, registered in src/games/registry.ts: each reads the session through its
 * selector (select.ts) and draws a pure component.
 */
import type { GameViews } from '../../../games/registry';
import { HoldemDock } from '../../docks/holdem';
import { HoldemHost } from '../../host/holdem';
import { holdemDockProps, holdemHostProps, holdemTableProps } from './select';
import { HoldemTable } from './table';

export const holdemViews: GameViews = {
  Table: ({ session }) => <HoldemTable {...holdemTableProps(session)} />,
  Dock: ({ session }) => <HoldemDock {...holdemDockProps(session)} />,
  HostPanel: ({ session }) => <HoldemHost {...holdemHostProps(session)} />,
};
