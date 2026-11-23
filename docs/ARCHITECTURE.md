# Architecture

## Where things are

R-005 is moving the app from one hand-written `index.html` to modules built by Vite, in phases (see `ROADMAP.md`).
After phase 2 the game rules are in `src/domain/`; everything else is still in `src/legacy.ts`:

| Path | What |
|---|---|
| `index.html` | The shell: the same `<head>` (manifest, icons, metas, fonts), the elements the script expects (`#app`, `#sheet`, `#toast`, `#fx`, `#rot`, `#fin`, the two file inputs), `config.js` and the two Firebase compat scripts as classic scripts, then `<script type="module" src="/src/main.ts">` |
| `src/main.ts` | Imports the styles and `legacy.ts` in order, and registers `sw.js` on `load` (in a build only: the dev server has no `sw.js`) |
| `src/legacy.ts` | The app script as it was in `index.html`, with `// @ts-nocheck` on top, except that it imports the game rules from `src/domain/`. Sections below |
| `src/domain/` | The game rules as pure, typed functions with unit tests next to them. See "The domain" below |
| `src/styles/*.css` | The old `<style>`, split at its section comments: `base`, `brand` (also cards, fields, buttons), `room` (header, table, seats, host panel, dock), `sheet` (also the toast), `blackjack`, `layout` (portrait/landscape), `rotate`, `end` |
| `public/` | Copied to the site root as is, so the URLs didn't change: `icons/`, `manifest.webmanifest`, `sounds/amb/`, `sounds/voice/` |
| `src/sw-template.js`, `scripts/sw-plugin.mts` | The service worker and the build step that writes `dist/sw.js` from it (see Updates) |

**Start-up.** `config.js` and the Firebase scripts are classic scripts in `<head>`, so they have run before the module
starts. The module is deferred: it runs once the body is parsed, before `DOMContentLoaded`, which is where the old inline
script at the end of `<body>` ran. Module code is strict mode; the script was checked for anything strict mode treats
differently (undeclared variables, function declarations inside blocks) and has none. Rule 2 still holds: `render()`
runs synchronously inside the `dbReady` IIFE while `legacy.ts` is being evaluated.

**Build.** `npm run build` (`vite build`) writes `dist/`: `index.html` with the hashed `assets/index-*.js` and
`assets/index-*.css` (relative URLs, `base: './'`), the `public/` files and the generated `sw.js`. `config.js` is not
part of the bundle: Netlify writes it afterwards with `node scripts/build-config.js dist`, because the self-update
fetches it by name and it must stay un-hashed.

## `src/legacy.ts`, top to bottom

The script is one IIFE. Sections are marked with `/* ---------- name ---------- */` comments, in this order:

| Section | What it does |
|---|---|
| state (`S`) | Everything the UI needs: identity (`myId`, `name`, `avatar`), current table (`code`, `room`, `players`), chips in hand (`pending`, `pendChips`), open sheet |
| casino background (`Ambience`, `playLine`) | Plays a looped crowd-murmur bed and schedules random slot-machine one-shots from `sounds/amb/`. Works on any AudioContext (also offline for `tests/audio.js`) |
| sounds (`SND`) | Chip clacks, slides, bell, drumroll, fanfare, applause, results, and the dealer narration `SND.say`. Unlocked on first touch |
| ambience control | `ambiSync()`: the background runs only inside an open table, screen on, sound on, setting on; it also starts loading the narration files |
| effects (`FX`, `fly`, `floatText`, `pulse`) | Flying chips on the `#fx` layer, overrides that hold the old picture until chips land |
| staying up to date | Compares `APP_BUILD` with the live `config.js` and reloads when idle |
| avatars | Prepared characters (`AV_SET`, drawn by `avSVG`), photo processing, `avInner()` for every avatar circle |
| local single-device store | `LocalDB`, same surface as Firestore, in localStorage |
| connect | Picks Firestore or `LocalDB`, opens the last table |
| writes | `w(path, op, data)`: one write at a time per document, errors shown as toasts. `inc(n)` (hoisted function) is the increment marker for the dealer's stack changes: `FieldValue.increment(n)` on Firestore, `{__inc: n}` in `LocalDB` |
| room session | Snapshot listeners for the room and its players; this is where effects are triggered |
| chips | `denoms()` (the room's chip set, from `domain/chips.ts`), `chipStyle`, `stackHTML`, `pendChips()`. The chip rules are imported from `src/domain/chips.ts` |
| change → animation | `fxPlayers`, `fxBJ`, `fxHold`, `fxRoom`, `lockFx` |
| Hold'em model / Blackjack model | Each action: read `S`, call the domain command, write the patch it returns (adding `ts`, wrapping dealer stack amounts in `inc()`), map a refusal to its toast, write the Hebrew event line. `H()`, `cur`, `bjStake`, `bjEligible`, `canAct`, `computeAward` are thin wrappers over the domain |
| create / join | New table, join, claim a seat |
| turn-the-phone prompt | Shown inside a table on a phone held upright |
| end of the game | Standings, `endGame`, `ceremony`, final card, closed sign |
| dealer figure | `dealerSVG`, `dealerNod` |
| views | `render()`, home, room, Hold'em and Blackjack tables, docks, host panels, sheets |
| events | `A` (all `data-a` actions), click/input handlers |

## The domain (`src/domain/`)

The game rules, with no DOM, no Firebase, no timers, no clock and no `S`: functions of the stored documents that
return what to write. `legacy.ts` imports them (`HR`, `Pots`, `BJ`, `BJA`, `BJR`, and the chip helpers by name).

| File | What |
|---|---|
| `types.ts` | `RoomDoc`, `PlayerDoc`, `BjHand`, `LastAction` as stored (every field optional), `Seat` (a player with its `pid`), `Outcome` |
| `chips.ts` | `DEN`, `N_CHIPS`, `MAX_CHIPS`, `denoms(game, sb, minBet)`, `chipLabel`, `chipsOf`, `sumOf`, `okChips`, `dispAmt`, `handStack`, `handHalves` |
| `holdem/rules.ts` | `STAGES`, `holdemState(room, players)` (the old `H()`: in hand, street bet, committed, pot, highest bet, minimum raise, live players), `canAct`, `classifyBet`, `bet`, `fold`, `activePlayers`, `blindSeats`, `newHand`, `nextStreet` |
| `holdem/pots.ts` | `computeAward(state, winners)` (side pots by contribution level, odd chip to the first winner in seat order), `award`, `cancelHandRefunds` |
| `blackjack/rules.ts` | `isCurrent` (the old `cur`), `stake`, `betLimitError`, `handReturn` (what each result gives back), `handRefund`, `insuranceCost`, `surrenderReturn`, `blackjackEligible`, `hasOpenBets` (paid spots are done), `alreadySettled` (`bjPaidRound`), `nextRoundId`, constants (`MAX_HANDS`, `BLACKJACK_PAYS`, `INSURANCE_RETURN`) |
| `blackjack/actions.ts` | A player's `placeBet`, `clearBet`, `play` (double, split, insurance, surrender), and the dealer's `payBlackjackNow` |
| `blackjack/round.ts` | The end of a round: `settleRound` (payout totals, house delta) and `cancelRound` (refunds) |

**Command → patch.** A command takes the documents (and what the player is holding, such as the chips in hand) and
returns `{ ok: true, patch, … }` with the fields to write, or `{ ok: false, reason }` with a string code
(`'over-max'`, `'not-enough-chips'`, `'unmarked'`…). The caller adds `ts`, writes, and maps the code to today's Hebrew
toast (or stays silent where it always did). Dealer changes to a player's stack come back as a plain number
(`stackInc`, or the amounts in `pays`/`refunds`); the caller writes them as `inc(n)`. Commands that touch several
documents return the player writes and the room write separately, and the caller keeps the order: players first, the
room last. Hebrew text stays in `legacy.ts` until R-006.

**Purity is enforced.** `eslint.config.mjs` refuses, in `src/domain/`, imports that leave the folder, packages (tests
may import `vitest`), DOM and timer globals, `Date.now`, `new Date` and `Math.random`. `tsconfig.domain.json` checks the
domain on its own without the DOM types, so a browser API there does not compile.

## Stored data (Firestore)

All fields marked *added* are optional and appeared after the first release. Readers must cope with
them missing.

### `rooms/{CODE}` (4 capital letters)

| Field | Meaning |
|---|---|
| `code`, `game` (`holdem` / `blackjack`), `startStack` | Table setup |
| `sb`, `bb` / `minBet`, `maxBet` | Blinds for Hold'em, limits for Blackjack (`maxBet` 0 = none) |
| `hostId`, `hostName` | The dealer |
| `createdAt`, `updatedAt`, `lastEvent {t, ts}` | Timestamps, and the line shown under the header |
| Hold'em: `handId`, `streetId`, `stage`, `potLevel`, `buttonPid`, `sbPid`, `bbPid` | Hand state. The pot is derived from players' `committed` above `potLevel` |
| Blackjack: `roundId`, `phase` (`betting` / `playing`), `house`, `dealerBJ` | Round state and the house balance |
| `roundEnd` *added* | Blackjack: how the last round ended, `'paid'` or `'cancelled'`. Set with the new `roundId`; the dealer narration says "payout" only for `'paid'`. Missing when an older phone ended the round (readers then fall back to the `lastEvent` text) |
| `mode` *added, read-only for now* | Table type. Missing = `'chips'`. Known to this build: `'chips'`. Nothing writes it yet (card tables will) |
| `appMin` *added, read-only for now* | Lowest `FEATURE_LEVEL` that can play this table. Missing = 0. Nothing writes it yet |
| `closed` *added* | The game is over; the table shows the final standings |
| `final {at, list:[{pid, name, stack}]}` *added* | Standings frozen when the dealer ended the game, highest first |

**Guard for unknown table types.** `tableUnsupported(room)` (`src/legacy.ts`, next to `now`) is true when `appMin > FEATURE_LEVEL`
or `mode` is present and not in `KNOWN_MODES`. For such a room `roomView` shows `updateView()` (title, an "עדכון" button
that runs `checkUpdate` and reloads, and a way home) instead of the table; the sheet is not shown; the room and
players listeners keep running (so the table renders once the phone is updated) but skip the effects; `w()` refuses
every write under `rooms/{CODE}` of that room; and the click dispatcher ignores every action except
`home`/`upd`/`reload`/`snd`/`retry`. The home list marks such tables "צריך עדכון". `FEATURE_LEVEL` is raised only
when a build really plays tables with that `appMin`. Card tables will also set the legacy Blackjack
`phase: 'cards'` / Hold'em `stage: 'cards'`, which make phones older than the guard refuse player actions
(proved in `tests/guard.test.js`).

### `rooms/{CODE}/players/{pid}` (`p_` + 6–16 lowercase letters/digits)

| Field | Meaning |
|---|---|
| `name`, `joinedAt`, `stack`, `sittingOut` | The player |
| Hold'em: `handId`, `streetId`, `streetBet`, `committed`, `folded`, `allIn` | Per-hand state |
| Blackjack: `bjRound`, `hands[]`, `insurance`, `surrendered` | Bets of the round `bjRound` |
| `hands[i]`: `bet`, `doubled`, `split`, `result` (`win`, `bj`, `push`, `lose`, `surrender`) | One betting spot |
| `hands[i].chips` *added* | The exact chips placed, bottom to top. Used only when they add up to `bet` |
| `hands[i].paid` *added* | A blackjack the dealer paid mid-round. The payout and a cancelled round skip it |
| `bjPaidRound` *added* | Number: the round the dealer last paid or refunded this player in. `bjPayout`/`bjCancelRound` skip a player whose value equals the current `roundId`, so a retry after a failed room write doesn't pay twice. Missing means not settled |
| `lastAction {k, amt, chips?}`, `ts` | The last thing that happened to this player; drives the animations |
| `avatar` *added* | `{k:'set', v:'<id from AV_SET>'}` or `{k:'img', v:'data:image/jpeg;base64,…'}` (about 5–14 KB), or `null` |

`lastAction.k` values: Hold'em `blind`, `check`, `call`, `bet`, `raise`, `allin`, `fold`, `won`, `refund`;
Blackjack `bet`, `clear`, `double`, `split`, `ins`, `surrender`, `bjpay` *added*, `bjres`, `refund`.

Writes that don't set `lastAction`/`ts` (avatar changes, sitting out) don't animate.

**Dealer writes to a player's stack are increments** (`stack: inc(n)`): `bjPayout`, `bjCancelRound`, `bjNow`,
`award`, `cancelHand`. They add to whatever the server holds, so they cannot overwrite a bet the player placed
in the meantime. A player's own writes (`bjBet`, `bjDo`, `hAct`, `bjClear`) still set absolute values. In
`bjPayout` and `bjCancelRound` the player documents are written first and the room document last (so nobody can
bet in the next round while payouts are in flight); the players' `bjres`/`refund` changes therefore reach the
phones just before the room's phase change, and the felt keeps showing the hands (behind the animation's
overrides) until the room flips. Tests: `tests/race.test.js`.

## Flows

**Blackjack round**: players bet (`bjBet`, `phase: betting`) → dealer locks bets (`deal`, `phase: playing`)
→ players double, split, insure or surrender (`bjDo`) → optionally the dealer pays a natural at once
(`bjNow`) → dealer marks every hand and pays (`bjPayout`: next `roundId`, `phase: betting`,
`lastAction: bjres`) or cancels (`bjCancelRound`). Hands of the previous round stay on the felt while any
of them has no result, so the payout animation has something to move.

**Hold'em hand**: `newHand` posts blinds → `hAct` per action → `nextStreet` → `award` (side pots by
contribution level) or `cancelHand`. The rules of each step are in `src/domain/holdem/`.

**End of the game**: `endGame` writes `closed` and `final` → every phone's room listener sees
`closed` switch on and runs `ceremony()` → on "לשולחן" the table renders closed with the sign.
A phone that loads an already-closed table shows the final card without the ceremony. `reopen` clears
`closed`.

## Effects

1. A snapshot arrives. Before rendering, `fxPlayers(old, new)` / `fxRoom(old, new)` decide what happened
   and may set `FX.ov[pid]` (what that player's spots and stack should still look like).
2. `render()` measures every `[data-k]` element into `FX.rects` (positions *before* this render), then
   redraws.
3. The returned functions run: `fly()` moves chip stacks on `#fx` (page coordinates) from old to new
   positions, and on landing clears the override and renders again.

`data-k` keys: `seat:<pid>`, `spot:<pid>:<i>`, `ins:<pid>`, `dealer`, `pot`, `mystack`, `pend`, `ghost`.

## Layout

The blackjack table is a box with `aspect-ratio: 100/98`. `--u` is 1% of its width, set from JS (`setU`),
so the whole table scales as one picture. Seats, betting circles and the printed text sit on ellipses with
one shared centre near the dealer (`GEO`); seats are spaced by arc length (`ARC`, `seatLayout`) so circles
never overlap. In landscape (`@media (orientation: landscape)`) the room becomes two columns: a side panel
(header, your chips, dealer controls) and the table sized by the screen height.

## Sound

`SND` owns one AudioContext created on the first touch (browsers require it). Effects are synthesized:
clay-chip clacks are short band-passed noise plus a click; the bell, drumroll, fanfare and applause are
oscillators and filtered noise.

**Background.** A quiet steady murmur of people plus a slot machine now and then. `AMB_MANIFEST` lists
`sounds/amb/crowd-bed.mp3` (kind `bed`, a generated ~39 s murmur already looped and filtered, see
`sounds/CREDITS.md`) and `machine-1..4` (kind `machine`). They are fetched and decoded the first time the background
is wanted (inside a table, not on the home screen); a missing file is skipped and retried at most once a minute.
`Ambience(c, dest, level, clips)` returns `{sched(untilTime), stop()}`; `sched` (called every 4 s by `SND.ambiStart`)
starts the bed as soon as it is loaded and schedules the machines.
- *Bed:* one `AudioBufferSourceNode` with `loop = true`, straight to `dest` (not through the event compressor), faded in
  over 3 s, started at a random offset so phones aren't in step. `loopBounds(buf)` (once per buffer, `WeakMap`) trims
  decoder silence and crossfades 50 ms at the seam, because MP3 changes the edges. Level `AMB_BED`: about −41 dBFS
  at the master (both channels summed), 6 dB under the talk clip the owner liked (−35 dBFS measured the same way).
- *Machines:* one random machine every 10–25 s (the first after 4–8 s), never the same twice running, one at a time,
  random pan ±0.8, ±3 dB gain jitter, through a 6 kHz lowpass, a light generated reverb (1.2 s, wet 0.25) and a gentle
  compressor (`AMB_LEVEL`).
Measured by `node tests/audio.js`: bed about −41 dBFS, loudest 50 ms about −23 dBFS. The header speaker, `ambiSync`
rules and the 6 dB ducking under narration apply to both. Every 45–120 s a synthesized "someone plays with their
chips" sound plays on top.

**Narration.** `SND.say(key)` plays `sounds/voice/<key>.mp3` (`open locked blackjack payout winner newhand flop turn
river allin closed`), loaded together the first time a table is open. One line at a time: a new one is dropped while
one plays, except `winner` and `closed`, which wait. The background bus is ducked 6 dB meanwhile. Level about −20
dBFS RMS (`VOICE_LEVEL`). Settings has a separate switch (`chips.voice`, default on); the header speaker mutes all.
Triggers run on every phone from the change→animation code, not only the acting one: `fxRoom` (blackjack bets
locked → `locked`; round paid, not cancelled → `payout`, 2.5 s later `open`; Hold'em new hand → `newhand`; stage
flop/turn/river), `fxHold` (`allin`, once per hand), `fxBJ` (`bjpay` → `blackjack`), `ceremony` (`winner` at the
reveal) and the `finclose` action (`closed`). Nothing is stored for this; it is all local.

## Updates

`scripts/build-config.js` writes `window.APP_BUILD` (the commit) into `config.js`. The app fetches
`config.js` (no cache) when it comes back to the screen, on focus, when back online and every 3 minutes.
On a different build it reloads as soon as the player has no chips in hand, no sheet open and isn't typing;
otherwise it shows a "יש גרסה חדשה" button. Phones running a version from before this existed need one
manual restart.

**Service worker.** `dist/sw.js` is generated at build time from `src/sw-template.js` by `scripts/sw-plugin.mts`:
`SHELL` (cached at install) is `./`, `index.html`, `config.js`, the manifest, three icons and every built JS/CSS file
with its hashed name; `CACHE` is `chips-` plus a hash of that list and the template, so every build that changes a
file gets a new cache and the old one (including the hand-written version's `chips-v6`) is deleted on activate.
Strategy as before: network first for the app's own files and for gstatic and Google Fonts, the cache when offline,
Firestore straight to the network. Netlify serves `sw.js` and `config.js` with `no-cache`, and `assets/*` as
immutable (their names change with their content). A phone on the old single-file version upgrades like this: its
update check sees the new `APP_BUILD` and reloads; the old worker fetches the new `index.html` from the network; the
browser installs the new worker, which caches the new shell and drops `chips-v6` (`tests/upgrade.test.js`).
