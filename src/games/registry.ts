/**
 * One entry per game (Strategy): what differs between Hold'em and Blackjack on the screens, so the screens ask the
 * registry instead of checking `game === 'holdem'` in every place.
 *
 * The screens use the names, the form fields and the per-game wording below, and draw each game's table, dock and
 * dealer controls from its `views` (R-005 phase 5).
 */
import type { ComponentType } from 'preact';
import type { Game } from '../domain/types';
import type { Session } from '../ui/session';
import { blackjackViews } from '../ui/tables/blackjack';
import { holdemViews } from '../ui/tables/holdem';

/** A table limit: Hold'em blinds or Blackjack bet limits, as typed in the create form and the dealer's settings. */
export interface LimitField {
  /** The field of the room (and of the forms). */
  key: 'sb' | 'bb' | 'minBet' | 'maxBet';
  /** The input ids are `c` + this in the create form and `e` + this in the settings. */
  id: string;
  label: string;
  /** A shorter label for the settings sheet, when the create form's doesn't fit there. */
  settingsLabel?: string;
}

/**
 * A game's parts of the room screen. Each reads the session through its selector (like the sheets) and draws a pure
 * component: the table (in `.stage`), your controls (in `.dock`), the dealer's controls (in `.o-host`).
 */
export interface GameViews {
  Table: ComponentType<{ session: Session }>;
  Dock: ComponentType<{ session: Session }>;
  HostPanel: ComponentType<{ session: Session }>;
}

export interface GameMode {
  id: Game;
  /** The game's name: the create form's choice, the room header, the settings. */
  name: string;
  /** The name in the home screen's list of tables. */
  listName: string;
  /** The table is a picture sized to the screen (`.stage.fit`), not a list that scrolls. */
  fitStage: boolean;
  /** The create form's "I play too" checkbox, and whether it starts ticked. */
  playLabel: string;
  dealerPlays: boolean;
  /** The dealer is the house: when not seated, they are offered a seat as a bettor instead of the join form. */
  dealerIsHouse: boolean;
  /** Players can take a break (sit out hands). */
  sitOut: boolean;
  /** The two limits, in the order the forms show them (the first on the right). */
  limits: [LimitField, LimitField];
  /** The cancel sheet: its title, what comes back, and the action it confirms. */
  cancel: { title: string; refunds: string; action: string };
  /** The end-game sheet, when chips are still on the table: what the dealer has to do first. */
  settleFirst: string;
  /** The table, dock and dealer controls. */
  views: GameViews;
}

export const GAMES: Record<Game, GameMode> = {
  holdem: {
    id: 'holdem',
    name: 'טקסס הולדם',
    listName: 'הולדם',
    fitStage: false,
    playLabel: 'אני גם משחק, לא רק מנהל',
    dealerPlays: true,
    dealerIsHouse: false,
    sitOut: true,
    limits: [
      { key: 'bb', id: 'bb', label: 'ביג בליינד' },
      { key: 'sb', id: 'sb', label: 'סמול בליינד' },
    ],
    cancel: { title: 'ביטול היד', refunds: 'ביד הזו וטרם חולקו', action: 'cancelhand' },
    settleFirst: 'חלקו את הקופה או בטלו את היד',
    views: holdemViews,
  },
  blackjack: {
    id: 'blackjack',
    name: "בלאק ג'ק",
    listName: "בלאק ג'ק",
    fitStage: true,
    playLabel: 'אני גם מהמר (לא רק הדילר)',
    dealerPlays: false,
    dealerIsHouse: true,
    sitOut: false,
    limits: [
      { key: 'minBet', id: 'min', label: 'הימור מינימלי' },
      { key: 'maxBet', id: 'max', label: 'הימור מקסימלי (0 = ללא)', settingsLabel: 'מקסימלי (0 = ללא)' },
    ],
    cancel: { title: 'ביטול הסיבוב', refunds: 'בסיבוב הזה', action: 'cancelround' },
    settleFirst: 'שלמו או בטלו את הסיבוב',
    views: blackjackViews,
  },
};

/** The game of a room or form: Hold'em only when it says so, anything else is Blackjack (as the views always drew it). */
export function gameMode(game: string | null | undefined): GameMode {
  return game === 'holdem' ? GAMES.holdem : GAMES.blackjack;
}
