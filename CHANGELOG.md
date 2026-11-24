# Changelog

Newest first. Dates are when the change reached `main` (the live site). "Not yet live" is on the
development branch.

## Not yet live

### Added
- **English** (R-006). Each phone chooses English or Hebrew: "EN / עב" in the home screen's top corner, or Language in
  Settings, and the screen switches at once, inside a table too. A new phone starts in Hebrew when its languages list
  Hebrew before English, otherwise in English; a phone that already used the app stays in Hebrew until its player
  switches. Every word follows the language: the screens, toasts, the words over the table, the closed sign, the
  ceremony, the table's event line, and the dealer's voice (new English recordings; the Hebrew ones are unchanged). In
  English the page reads left to right, while the table stays the same picture. Players with different languages share
  a table: the event line is stored with its key (and still in Hebrew, for phones on an older version). The installed
  app is called "Chips" in English. For us: `src/i18n/` (catalogs, `t()`, plurals, `formatChips`), a lint check that
  no Hebrew is left in the code, English screenshots of every screen, and the two-phone test with a Hebrew phone, an
  English phone and a phone on the old version.

### Changed
- **The app is now built with Vite** (R-005, step 1 of the code foundations). For players nothing changes: the
  same screens pixel for pixel, the same sounds, and phones update themselves into the new version as usual. For us:
  the code lives in `src/` (still one script for now), Netlify runs `npm run build` and publishes `dist/`, the
  service worker's file list comes from the build, and there are lint, type and unit checks, a pixel comparison of
  ten screens (`tests/visual.js`) and a test of a phone upgrading from the old version (`tests/upgrade.test.js`).
- **The game rules are separate, tested code** (R-005, step 2). Nothing changes for players. For us: chips, Hold'em
  (blinds, betting, side pots) and Blackjack (limits, double, split, insurance, surrender, payouts) are pure functions
  in `src/domain/` with 135 unit tests (`npm test`, `npm run coverage`); the app calls them.
- **Storage is behind one interface** (R-005, step 3). Nothing changes for players, and stored tables keep their
  shape. For us: Firestore and single-device mode are two adapters of a `Store` port in `src/data/`, the write queue is
  there too, and every fallback for a missing or damaged stored field is in `normalizeRoom` / `normalizePlayer`, applied
  when a table is read. Contract tests run the same cases against single-device mode and the browser tests' Firestore
  stand-in.
- **Effects come from events** (R-005, step 4). Nothing changes for players: the same flying chips, timings, sounds
  and dealer lines, on every phone. For us: each table change is turned into named events (a bet placed, a hand
  split, a pot won, bets locked…) by a pure, unit-tested diff in `src/sync/`; the animations in `src/fx/` and the
  narration in `src/audio/` subscribe to them. The sound engine and the casino background moved to `src/audio/`, and
  the app now starts from `main.ts` after everything is wired. The two-phone and Hold'em tests check that a bet flies
  exactly once on the other phones; `AUDIO_SEED` makes `tests/audio.js` repeatable.
- **Home, the room's header and every sheet are Preact components** (R-005, step 5, part A). For players the screens
  look the same pixel for pixel; one thing is better: a sheet no longer jumps back to the top when you tap in it
  (marking the 8th hand in "סיום סיבוב" kept scrolling you up). For us: `src/ui/` holds the screens (home, the room's
  shell, the update screen, the final card) and one component per sheet, mounted by `main.ts`; the tables, the docks
  and the dealer controls are still HTML strings shown inside the components until parts B and C convert them.
  `src/games/registry.ts` holds what differs between Hold'em and Blackjack on those screens. The pixel comparison now
  covers 56 screens (every sheet, the tables in their states, home, the update and closed screens), and
  `tests/behaviour.test.js` checks what a render must keep (the caret, scroll positions, typed amounts).
- **The Blackjack table, your controls and the dealer's are Preact components** (R-005, step 5, part B). The table
  looks the same pixel for pixel in every state we test (portrait, landscape, a small phone, chips in hand, insurance,
  a split and a double, a blackjack paid at once, the payout's results, a crowded and an empty table, the closed
  table). A few things are smoother: the table is updated rather than rebuilt, so the dealer's nod, a spot's bump and
  the glow of your empty spot play to the end instead of being cut off when someone else acts, and the dealer's blink
  keeps its rhythm. For us: `src/ui/tables/` (`BlackjackTable`, seats and betting circles, `ChipStack`,
  `DealerFigure`, the geometry with unit tests), `src/ui/docks/` and `src/ui/host/`, registered in
  `src/games/registry.ts`; Hold'em is still drawn from HTML strings until part C.
- **The Hold'em table, your controls and the dealer's are Preact components** (R-005, step 5, part C), so every
  screen of the app is now a component. The Hold'em table looks the same pixel for pixel (blinds, a short call and a
  raise under the minimum, a fold, all-in with a side pot, the showdown, one player left, between hands, a break,
  waiting for the next hand, landscape, a small phone, an empty table). As with Blackjack, the table is updated rather
  than rebuilt, so the dealer's nod plays to the end and her blink keeps its rhythm. For us: `src/ui/tables/holdem/`
  (`HoldemTable`, the player rows, selectors with unit tests), `src/ui/docks/holdem.tsx`, `src/ui/host/holdem.tsx`,
  registered in `src/games/registry.ts`; the HTML-string views and `LegacyHtml` are gone from the code. The pixel
  comparison covers 72 screens.
- **The app is now built entirely from small modules** (R-005, step 6, the last of the code foundations). For players
  nothing changes. For us: the old app script (`src/legacy.ts`) is gone. The state, the actions (one file per concern),
  the room session, navigation, the render, the update check and the ceremony are typed modules in `src/app/`,
  `src/sync/room-session.ts` and `src/update.ts`; nothing is unchecked by TypeScript or ESLint any more. The ceremony and
  the turn-the-phone prompt are Preact components too. GitHub Actions now runs every check on every push and pull
  request (lint, types, unit tests with coverage, the build, all the browser tests, and a pixel comparison with the
  earlier version rendered on the same machine). The pixel comparison covers 73 screens.

### Fixed
- **The winner's circle in the end-of-game ceremony has the winner's own colour.** A winner without a picture was always
  shown on the same colour (worked out from a missing id) instead of the colour their circle has everywhere else.

## 2026-11-22 (2)

### Added
- **Phones refuse table types they don't understand.** A table that needs a newer version of the app shows
  "השולחן הזה צריך גרסה חדשה יותר" with an update button instead of the table, the phone never writes to it, and
  the home list marks it "צריך עדכון". Nothing changes for today's tables. This has to reach every phone before
  the first card table exists (`tests/guard.test.js`).
- **A Hold'em test on three phones** (`tests/holdem.test.js`): blinds, betting rounds, awarding the pot, an all-in
  with a side pot, and cancelling a hand, checked on every phone with the total chips unchanged. For us, not for
  players; it protects Hold'em during the coming changes.

### Fixed
- **Chips could appear from nowhere if a player bet the moment a new Blackjack round opened.** The dealer's
  phone wrote each player's new chip count as a fixed number worked out from its own (possibly old) copy,
  and could overwrite a bet placed a moment earlier. Now the dealer adds to the player's chips instead of
  replacing them, and players are paid (or refunded) before the next round opens. Same for a mid-round
  blackjack, a cancelled hand and Hold'em payouts. If the connection drops half way, pressing pay again
  doesn't pay anyone twice.

## 2026-11-22

### Changed
- **New casino background: a steady, quiet murmur of people with a slot machine now and then.** A generated
  murmur (no clear words, about 39 s, looped seamlessly) plays softly all the time, and a random slot-machine
  sound plays every 10–25 s on top (recordings in `sounds/amb/`, credits in `sounds/CREDITS.md`). The old
  talk and laugh one-shots are gone.
- **Dealer narration** (Hebrew, `sounds/voice/`): "bets are locked", "payout", "new hand", flop/turn/river,
  all-in, blackjack, "winner" and "table closed", heard on every phone. Own switch in Settings
  ("קריינות הדילרית"); the speaker button still mutes everything.
- Someone at the table plays with their chips less often (every 45–120 s instead of 15–40 s).

### Fixed
- Input fields stuck out of their cards and the two blind fields overlapped (home screen and forms).
- The picture circle on the home screen shows your first letter as you type your name.

## 2026-11-21 (5)

### Added
- **Avatars**: take a photo with the front camera, pick one from the gallery, or choose one of 16
  illustrated characters. Set it on the home screen, when joining, by tapping your own seat, or from
  Players. Remembered on the phone and used at every table. Photos are cropped and shrunk to a few KB and
  stored on the player (`avatar`).
- **Dealer declares a blackjack mid-round**: "בלאק ג'ק לשחקן" pays a natural 3:2 at once, with an
  animation on every phone. The hand is marked `paid` so the payout and a cancelled round skip it.
- Documentation: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `lessons-learned.md`, this file.
- `ROADMAP.md`: every planned update and fix with a detailed plan, a template for new entries, and the
  first proposed entries; plans for version 2 (code foundations, English, Hold'em table, statistics,
  card mode with animations, voice messages, live voice), ordered by importance and updated with the
  owner's decisions.
- Browser tests in `tests/`: two phones syncing, layout screenshots, audio levels.

### Fixed
- The casino background sounded like white noise: the constant room-tone layer is removed; the crowd and
  slot machines carry it, about 6 dB quieter overall.

## 2026-11-21 (4)

### Added
- **End of the game**: the dealer's "סיום המשחק" shows the standings and announces the winner. Every
  phone plays the ceremony (spotlight and drumroll, fanfare and applause, crown, chip rain, standings),
  then the table closes with a swinging "השולחן סגור" sign. Closed tables show the final standings, can be
  replayed or reopened, and leave the active-tables list.
- **Self-updating**: each deploy stamps `APP_BUILD`; open apps reload into the new version when idle, or
  show a "יש גרסה חדשה" button. Settings shows the version.

### Fixed
- Small avatars (Hold'em player list) had lost their colour.

## 2026-11-21 (3)

### Added
- **Exact chip stacks**: the chips you place are saved with the bet, so five 1-chips show as five 1-chips
  on every phone. Doubles copy the stack, splits share it.
- **Casino background**: a distant crowd talking and slot machines, with a switch in Settings.

## 2026-11-21 (2)

### Added
- Now and then someone at the table plays with their chips (riffles, taps, counting).
- An illustrated female dealer behind the table; she blinks and nods when bets lock or a hand starts.

## 2026-11-21 (1)

### Added
- **Landscape layout**: the table fills the screen height, controls move to a side panel.
- A "turn your phone" prompt with an animation, only inside a table on a phone held upright.
- **Blackjack table**: dealer and chip rack at the top, players seated around the rail, a betting circle
  per seat with the bet as a chip stack; split hands, doubles and insurance shown on the felt.
- **Chip animations**: chips fly to circles and the pot, losing bets to the dealer, payouts to winners;
  splits and double downs animate.
- **Sounds**, synthesized: chip clacks, slides, knock on check, fold, bell, win / blackjack / lose jingles.
  Speaker button in the header.

### Changed
- Chips only: no card animations or card sounds.

## 2026-10-15
- Firebase config moved to Netlify environment variables (`scripts/build-config.js`).

## 2026-10-14
- First version: a chip table PWA for Texas Hold'em and Blackjack, synced with Firestore.
- Chip tray follows the table minimum (1, 2 and 2.5K chips added; six chips per tray).
- Firestore rules allow listing rooms and players.
- The dealer shows at the table even when not seated; connection status and sync errors in the header.
- Netlify config.
