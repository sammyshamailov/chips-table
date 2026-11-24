# Changelog

Newest first. Dates are when the change reached `main` (the live site). "Not yet live" is on the
development branch.

## Not yet live

_Nothing yet._

## 2026-11-24

### Added
- **Tapping on the table (R-016), Blackjack only.** A "דפיקה" button (an open hand) in every player's dock, and in
  the dealer's controls for a dealer who isn't seated. Pressing it makes your hand drum on the felt at your seat
  (the dealer's, at the chip rack) three or four times, with a knock for every hit, on every phone at the table.
  Several players at once drum together (at most four hands on screen). One press every 2 seconds; the button dims
  meanwhile. With reduced motion the seat just shakes. The hand is original art (three variants, picked by player),
  the knock is synthesized (a low thump plus a short slap, pitched per player) and kept under the chip sounds
  (`node tests/audio.js`). Stored data: the optional `tap` on a player and `dealerTap` on the room (number, time of
  the press); neither touches `lastAction`/`ts`, older phones ignore them, no change to `firestore.rules`. A phone
  that opens or reloads the table never replays old taps. Test: `tests/tap.test.js`. The card-mode ace pulse waits for R-011.
- The blackjack dock no longer widens the page when the chip count, the chips in hand and the new button don't fit
  on one line (the chip-count label wraps instead).

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
