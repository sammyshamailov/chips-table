# Architecture

## Where things are

The app is built by Vite from `src/` (TypeScript, strict; Preact for the screens). `index.html` is only the shell. Each
folder has one job, and the arrows between them only point one way: the rules (`domain/`) know nothing else; storage
(`data/`) and the document diff (`sync/`) know the rules; the screens (`ui/`) draw what they are given; the app
(`app/`) holds the state and the actions and ties it together; `main.ts` creates everything.

| Path | What |
|---|---|
| `index.html` | The shell: the `<head>` (manifest, icons, metas, fonts), the elements the app draws into (`#app`, `#sheet`, `#toast`, `#fx`, `#rot`, `#fin`, the two photo inputs), `config.js` and the two Firebase compat scripts as classic scripts, then `<script type="module" src="/src/main.ts">` |
| `src/main.ts` | The composition root (see Start-up): imports the styles, creates the storage, the event bus, the sound engine, the effects layer and the screens, creates the app, wires the event subscribers, calls `app.start()`, and registers `sw.js` on `load` (in a build only: the dev server has no `sw.js`) |
| `src/app/` | The app: the state `S`, the actions, the render, the ceremony. See "The app" below |
| `src/domain/` | The game rules as pure, typed functions with unit tests next to them. See "The domain" below |
| `src/data/` | Storage: the `Store` port and its adapters, the write queue, and `normalize*()`; `browser-storage.ts` (localStorage with errors swallowed). See "The data layer" below |
| `src/sync/` | `diff.ts` (old/new documents → events, pure), `domain-events.ts` (the event types), `events.ts` (the two-phase event bus), and `room-session.ts` (the store's listeners that feed them). See "Reading a table" and "Effects" below |
| `src/fx/` | `layer.ts` (`#fx`, `fly`, `floatText`, `pulse`, `measure`, `rectOf`, the overrides `FX`), and the subscribers `blackjack.ts`, `holdem.ts`, `room.ts` (lock, new hand, `dealerNod`) |
| `src/audio/` | `synth.ts` (the engine `SND`: AudioContext, synthesized effects, settings), `ambience.ts` (the casino background), `narration.ts` (the dealer's voice and its triggers), `control.ts` (`ambiSync`, the first-touch unlock, the ambient chips). See "Sound" below |
| `src/ui/` | The screens as Preact components (see "Screens"), the ceremony's picture (`ceremony.tsx`), the turn-the-phone prompt (`rotate.tsx`), the table's scale (`scale.ts`), photo shrinking (`photo.ts`), plus `format.ts` (`fmt`) and `chips-html.ts` (`chipStyle`, `stackHTML`, `stackColumns`), shared with the effects (the chips in the air) and the ceremony (chip rain) |
| `src/games/registry.ts` | `GAMES` / `gameMode(game)`: one `GameMode` per game (Strategy), what differs between Hold'em and Blackjack on the screens, and each game's table, dock and dealer controls |
| `src/update.ts` | Staying up to date: compares `APP_BUILD` with the live `config.js` and reloads when idle (see Updates) |
| `src/globals.d.ts` | What the classic scripts put on `window`: `APP_BUILD`, `FIREBASE_CONFIG`, `firebase` |
| `src/styles/*.css` | The styles, split at their old section comments: `base`, `brand` (also cards, fields, buttons), `room` (header, table, seats, host panel, dock), `sheet` (also the toast), `blackjack`, `layout` (portrait/landscape), `rotate`, `end` |
| `public/` | Copied to the site root as is, so the URLs didn't change: `icons/`, `manifest.webmanifest`, `sounds/amb/`, `sounds/voice/` |
| `src/sw-template.js`, `scripts/sw-plugin.mts` | The service worker and the build step that writes `dist/sw.js` from it (see Updates) |

**Which folder may use which.** Enforced where it matters most: `src/domain/` imports nothing outside itself and uses
no DOM, timers, clock or randomness (ESLint and `tsconfig.domain.json`); `src/sync/` (except `room-session.ts`)
imports only the domain and is pure the same way (ESLint), so every phone turns the same documents into the same
events. By convention: `data/` imports only the domain; `ui/` components get what they show through props (only the
screens and the selectors read the session) and never import `app/`; `app/` may use everything below it.

## How it fits together

**Start-up.** `config.js` and the Firebase scripts are classic scripts in `<head>`, so they have run before the module
starts. The module is deferred: it runs once the body is parsed, before `DOMContentLoaded`.

No module does work when it is imported (CLAUDE.md rule 2). `main.ts`, in order: `browserStorage()`, `createEventBus()`,
`createSound()` and `createAmbiSync()`, `startAudioControl()` (first-touch unlock, screen on/off, the ambient chips
loop), `createFxLayer()`, `createUi({ app, sheet, toast })` (the screens' renderer on those elements; mounts nothing
yet), `createApp({ bus, snd, layer, storage, ambiSync, ui })` (builds the state, the write queue, the room session, the
actions and the renderer; renders nothing, listens to nothing), the subscribers (`GameEnded` → `app.ceremony()`, then
`subscribeBlackjackFx`, `subscribeHoldemFx`, `subscribeRoomFx`, then `subscribeNarration`), the
`window.ChipsAmbience`/`ChipsLine`/`CHIPS_BG` hooks for `tests/audio.js`, and finally `app.start()`: it starts the
listeners (resize and turning, the update check, the photo inputs, the screen wake lock, the install prompt, the page's
click/input/keydown), connects (`connect()`), lists the open tables, enters the last table or renders home,
synchronously. Because everything is created before `start()`, a render can reach only what exists, and the
subscribers exist before the first snapshot. The sound engine and the layer call back into the app (`render`, `myId`,
`inTable`) only from a touch, a timer or an event.

**Reading a table** (store → session → normalise → state → diff → events → effects, render → Preact):

1. The store (`src/data/`: Firestore, or this phone only) calls the room session's listeners
   (`src/sync/room-session.ts`) with a snapshot of the room or of its players.
2. The session normalises it (`normalizeRoom` / `normalizePlayer`, `src/data/schema.ts`: every missing field filled in)
   and diffs it against what the phone had (`diffRoom` / `diffPlayers`, `src/sync/diff.ts`) into domain events.
3. `bus.emit(events, commit)` (`src/sync/events.ts`): every subscriber's `before` (an effect keeps the old picture in
   `FX.ov`), then `commit` stores the documents in the state (`S.room`, `S.players`) and calls `render()`, then every
   `after` (the effects in `src/fx/` animate, `src/audio/` plays and narrates).
4. `render()` (`src/app/render.ts`) measures the positions the effects need (`FX.rects`), then Preact patches `#app`
   and `#sheet` from the state through the session (`src/ui/`). See "Screens" and "Effects".

**Acting** (tap → action → domain → patch → write):

1. A tap on any `[data-a]` element reaches the one click listener (`src/app/dom-events.ts`), which runs the action of
   that name with the element's `data-v`. Typing in a `[data-bind]` field writes the state directly.
2. The action (`src/app/actions/`) reads the state and asks the rules (`src/domain/`), which return the fields to write
   or a refusal code.
3. The action writes the patch through the write queue (`src/data/writes.ts`: one write at a time per document),
   adding `ts`, and the dealer's stack changes as increments (`inc(n)`); a refusal becomes a Hebrew toast.
4. The store sends the new document back to every phone, the acting one included, and "Reading a table" takes over:
   the effects come from the change itself, so every phone plays them.

**Build.** `npm run build` (`vite build`) writes `dist/`: `index.html` with the hashed `assets/index-*.js` and
`assets/index-*.css` (relative URLs, `base: './'`), the `public/` files and the generated `sw.js`. `config.js` is not
part of the bundle: Netlify writes it afterwards with `node scripts/build-config.js dist`, because the self-update
fetches it by name and it must stay un-hashed.

## The app (`src/app/`)

| File | What |
|---|---|
| `app.ts` | `createApp(deps)`: creates the state, the write queue (with the unsupported-table refusal and the error toasts), the update check, the install prompt, the wake lock, the table scale, the ceremony, the session, the renderer, the room session, navigation and the actions; returns `start`, `render`, `ceremony`, `myId`, `inTable` for `main.ts` |
| `state.ts` | `State` (`S`): identity (`myId`, `name`, `avatar`), the store and connection (`db`, `mode`, `readOnly`), the current table (`code`, `room`, `players`, sync flags, the listeners), chips in hand (`pending`, `pendChips`), the open sheet and its selections, the forms. `createState()` reads what the phone remembers; pure questions about it: `playerList`, `me`, `isHost`, `nameOf`, `holdem`, `roomDenoms`, `standings`, `pendChips`, `newPlayer`, the paths and `eventLine` |
| `context.ts` | `AppContext`: what the actions work with (the state, storage, the sound engine, the effects layer, `write`, `inc`, `render`, `paint`, `toast`, `now`, `buzz`); `Action`, `Actions` |
| `actions/` | The `data-a` actions, by concern: `lobby.ts` (new table, join, open, sit down, "play as", home, single-device mode), `table.ts` (sheets, the dealer's players list and settings, switch game, invite, end and reopen the game), `chips.ts` (chips in hand: a chip from the tray flying to your spot, presets, clear), `holdem.ts`, `blackjack.ts` (each action: read the state, call the domain command, write the patch, map a refusal to its toast, write the Hebrew event line), `avatar.ts` (your picture, the photo inputs), `app.ts` (sound switches, install, update, the ceremony's buttons, the turn-the-phone prompt) |
| `dom-events.ts` | The page's listeners: `data-a` clicks (on the update screen only home/update/reload/sound/retry act), `data-bind` input, Enter in the code field, Escape |
| `navigation.ts` | `connectStore()` (picks the store, lists the open tables, enters the last table or the invite's), `enter(code)`, `home()`, `useLocal()`, `ready()` (creating or joining waits for the connection) |
| `session.ts` | `createSession()`: the `Session` the screens read (see Screens), answered from the state, the rules and the effects layer |
| `render.ts` | `render()` and `paint()` (see Screens) |
| `ceremony.ts` | The end-of-game timeline (spotlight and drumroll, the reveal with the card and raining chips, the standings), drawing `Ceremony` (`src/ui/ceremony.tsx`) into `#fin` with Preact at each step; `hide()` |
| `device.ts` | `buzz()`, the screen wake lock at a table, the install prompt |
| `ids.ts` | Random player ids and table codes |

## The domain (`src/domain/`)

The game rules, with no DOM, no Firebase, no timers, no clock and no `S`: functions of the stored documents that
return what to write. The actions (`src/app/actions/`) call them; the session and the screens' selectors ask them.

| File | What |
|---|---|
| `types.ts` | `RoomDoc`, `PlayerDoc`, `BjHand`, `LastAction` as stored (every field optional), `Seat` (a player with its `pid`), `Outcome` |
| `chips.ts` | `DEN`, `N_CHIPS`, `MAX_CHIPS`, `denoms(game, sb, minBet)`, `chipLabel`, `chipsOf`, `sumOf`, `okChips`, `dispAmt`, `handStack`, `handHalves` |
| `holdem/rules.ts` | `STAGES`, `holdemState(room, players)` (the old `H()`: in hand, street bet, committed, pot, highest bet, minimum raise, live players), `canAct`, `classifyBet`, `bet`, `fold`, `activePlayers`, `blindSeats`, `newHand`, `nextStreet` |
| `holdem/pots.ts` | `computeAward(state, winners)` (side pots by contribution level, odd chip to the first winner in seat order), `award`, `cancelHandRefunds` |
| `blackjack/rules.ts` | `isCurrent` (the old `cur`), `stake`, `betLimitError`, `handReturn` (what each result gives back), `handRefund`, `insuranceCost`, `surrenderReturn`, `blackjackEligible`, `hasOpenBets` (paid spots are done), `alreadySettled` (`bjPaidRound`), `nextRoundId`, constants (`MAX_HANDS`, `BLACKJACK_PAYS`, `INSURANCE_RETURN`) |
| `blackjack/actions.ts` | A player's `placeBet`, `clearBet`, `play` (double, split, insurance, surrender), and the dealer's `payBlackjackNow` |
| `blackjack/round.ts` | The end of a round: `settleRound` (payout totals, house delta) and `cancelRound` (refunds) |
| `guard.ts` | `FEATURE_LEVEL`, `KNOWN_MODES`, `tableUnsupported(room)`: the guard against table types this build doesn't play (R-009; in the domain so the diff can use it) |

**Command → patch.** A command takes the documents (and what the player is holding, such as the chips in hand) and
returns `{ ok: true, patch, … }` with the fields to write, or `{ ok: false, reason }` with a string code
(`'over-max'`, `'not-enough-chips'`, `'unmarked'`…). The caller adds `ts`, writes, and maps the code to today's Hebrew
toast (or stays silent where it always did). Dealer changes to a player's stack come back as a plain number
(`stackInc`, or the amounts in `pays`/`refunds`); the caller writes them as `inc(n)`. Commands that touch several
documents return the player writes and the room write separately, and the caller keeps the order: players first, the
room last. Hebrew text stays in the actions until R-006.

**Purity is enforced.** `eslint.config.mjs` refuses, in `src/domain/`, imports that leave the folder, packages (tests
may import `vitest`), DOM and timer globals, `Date.now`, `new Date` and `Math.random`. `tsconfig.domain.json` checks the
domain on its own without the DOM types, so a browser API there does not compile.

## The data layer (`src/data/`)

Storage behind one interface, so the app doesn't care whether a table lives in Firestore or on this phone, and every
fallback for a stored field is in one place.

| File | What |
|---|---|
| `store.ts` | The `Store` port, exactly the surface the app uses: `doc(path)` → `get`, `set`, `update`, `delete`, `onSnapshot(next, error?)`; `collection(path)` → `orderBy`, `limit`, `where(field, '==', value)`, `get`, `onSnapshot`; `increment(n)`. Snapshots: `DocSnap` (`id`, `exists`, `data()` a fresh copy, `metadata.fromCache`), `QuerySnap` (`docs`, `size`, `empty`, `metadata`). `Unsubscribe`, `StoreError` (`code`) |
| `firestore-store.ts` | The adapter over the Firebase **compat** SDK, passed in (`window.firebase` from gstatic; the browser tests pass `tests/fakefs.js`). `initializeApp(config)`, `firestore()`, the same `settings(...)` as always; snapshots converted to the port's shape; `increment` is `FieldValue.increment` |
| `local-store.ts` | Single-device mode, the old `LocalDB` unchanged in behaviour: the whole database as JSON under `chips.localdb` in the key-value storage it is given (the app's `ls`), increments as `{__inc: n}`, nested maps merged on `update` (Firestore replaces them), an update of a missing document rejected with `invalid_argument`, listeners told after `setTimeout(0)`. `memoryStorage()` is an in-memory storage for tests |
| `connect.ts` | `connect(config, firebase, storage)`: Firestore when `config.js` has a real config (a `projectId`, an `apiKey` not starting with `PASTE`) and the SDK loaded and started; otherwise single-device mode. Synchronous |
| `writes.ts` | `createWriter({ store, onError, refuse })` → `write(path, op, data)` and `inc(n)`. One write at a time per document (a write waits for the previous one to that path, even if it failed); different documents in parallel; a failure goes to `onError` once and resolves `false`; `refuse(path)` (the unsupported-table guard) resolves `false` without writing. The store is asked for on every write, so switching to single-device mode takes effect at once |
| `schema.ts` | `Room` and `Player`: the domain's `RoomDoc` / `PlayerDoc` with every field present. `normalizeRoom(raw)` / `normalizePlayer(raw)` (and `normalizeHand`, `normalizeLastAction`, `normalizeAvatar`) |

**Normalising.** The room session, the home list and nothing else call `normalize*()`, on every snapshot; writes are
never normalised (they stay the patches they always were, and nothing writes a normalised document back whole). The
fallbacks:
- numbers missing or not numbers → 0; flags → `!!value`; text → `''`; `hands` → `[]` (entries that aren't objects
  dropped); `stage` → `'idle'`, `phase` → `'betting'`, `roundId` → 1 (what a new table is created with); `game` →
  `'holdem'` only when it says so, otherwise `'blackjack'` (as every view already drew it);
- `null` where "missing" means something: `bjRound` (no bet), `bjPaidRound` (never settled), `lastAction`, `avatar`
  (`{k, v}` with both text, else null), `buttonPid`, `sbPid`, `bbPid`, `lastEvent` (`{t, ts}`), `final`
  (`{at, list:[{pid, name, stack}]}`);
- absent when missing, because their readers tell missing from any value: `roundEnd` (any text kept), `mode` (text
  kept; anything else becomes its JSON text, so it never matches a known mode), `appMin` (`Number(value)`, NaN kept,
  as the guard always read it);
- `hands[i]`: `bet` a number; `chips` kept only when they add up to `bet` (`okChips`); `result` text or null; no flag
  added that wasn't stored, because the Blackjack commands copy hands and write them back;
- `lastAction`: null without a text `k`; `amt` dropped unless a number, `chips` unless an array;
- unknown fields and values are kept everywhere (a newer phone may have written them).

## Stored data (Firestore)

All fields marked *added* are optional and appeared after the first release. Their fallbacks, and the fallbacks for
damaged values, are in `normalizeRoom` / `normalizePlayer` (above); a new field gets its fallback there.

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

**Guard for unknown table types.** `tableUnsupported(room)` (`src/domain/guard.ts`) is true when `appMin > FEATURE_LEVEL`
or `mode` is present and not in `KNOWN_MODES`. For such a room the room screen shows `UpdateView` (title, an "עדכון" button
that checks for an update and reloads, and a way home) instead of the table; the sheet is not shown; the room and
players listeners keep running (so the table renders once the phone is updated) but skip the effects; the write queue (its `refuse` option, set in `src/app/app.ts`) refuses
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

**Dealer writes to a player's stack are increments** (`stack: inc(n)`, `Store.increment`): `bjPayout`, `bjCancelRound`, `bjNow`,
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

## Screens (`src/ui/`)

Every view is a Preact component (R-005 phase 5 converted them from HTML strings, phase 6 the ceremony and the
turn-the-phone prompt). Three Preact roots: `#app` and `#sheet` (drawn by `render()`), and `#fin` (the ceremony, drawn by
its timeline); `#rot` is drawn by `render()` too. `#toast` is the toaster's, `#fx` the effects layer's.

| File | What |
|---|---|
| `app.tsx` | `App` (home, or the room screen when a table code is set) and `createUi(el)` → `paint(session)` (renders `App` into `#app` and sets `#app`'s class), `paintSheet(session, open)` (renders `SheetScreen` into `#sheet`, or empties it, and sets `hidden`), `toast(text)` |
| `session.ts` | `Session`: the state (`S`) and the questions screens ask (`me`, `players`, `isHost`, `holdem`, `award`, `bjCurrent`, `chipsOnTable`, `standings`, `looksClosed`, `newBuild`, `sound`, `denoms`…), and `fx` (`TableFx`: what the table shows while chips fly: `ov`, `shownStack`, `ghost` (your chips in hand that have landed), `signDrop`) |
| `screens/home.tsx` | `Home`: name and avatar, join by code, `RoomsList` (marks tables the guard refuses "צריך עדכון"), `CreateCard` |
| `screens/room.tsx` | `RoomScreen`: loading, not found, `UpdateView` (R-009), or the room: `RoomHeader`, the mode banner, the "new version" button, the event line, `JoinCard`, the dealer controls (in `.o-host`), `FinalCard`, the dock (in `.dock` › `.dock-in`, when you sit at an open table) and the table (in `.stage`): the game's `views` components. `appClass()`: `in-room`/`has-dock`, nothing, or unchanged while loading (as before) |
| `screens/update.tsx` | `UpdateView`, the R-009 guard screen |
| `sheets/index.tsx` | `SheetScreen`: the `.sheet` panel, keyed by the sheet's name (a re-render keeps it and its scroll; another sheet starts fresh), and the sheet named by `state.sheet` |
| `sheets/*.tsx` | One per sheet: `players`, `settings`, `award`, `settle`, `avatar`, `bj-now`, `end`, `cancel`. Each is a pure component and a selector (`playersProps(session)`…); only `SheetScreen` calls the selectors |
| `tables/chip-stack.tsx` | `ChipStack`: a stack seen from the side (`.stk` › `.col` › `.cd`), from exact chips or an amount; the same markup as `stackHTML`, which the chips in the air still use |
| `tables/dealer-figure.tsx` | `DealerFigure`: the dealer's SVG. The blink's phase (`blinkDelay`, a negative `animation-delay` from the clock) is taken once when the figure appears: Preact keeps the element, so the animation runs on; changing the delay of a running animation would make it jump |
| `tables/closed-sign.tsx` | `ClosedSign` (`drop` while it falls in after the ceremony) |
| `tables/blackjack/` | `table.tsx` (`BlackjackTable`: the felt and its printed arcs, the dealer and her rack, the placards, the round's state, the seats; `.dense` over 7 players), `seat.tsx` (`BjSeat`: a player's `BetCircle`s, insurance spot and seat; `BjSeatView`), `geometry.ts` (`GEO`, `ept`, `seatLayout`, `arcPath`, `spotsAt`: see Layout), `select.ts` (the selectors `blackjackTableProps`, `blackjackDockProps`, `blackjackHostProps`: the only Blackjack view code that reads the session), `index.tsx` (`blackjackViews`, registered in the registry) |
| `tables/holdem/` | `table.tsx` (`HoldemTable`: the dealer behind it, the felt with the street and hand, the blinds, the five board slots, the pot and the street's bet; then the rows, keyed by player), `seat-row.tsx` (`SeatRow`: avatar, name, tags, chips, last action, this street's bet, "play as"; `DealerRow` for a dealer who doesn't play), `select.ts` (`holdemTableProps`, `holdemDockProps`, `holdemHostProps`, and the pure parts they use: `seatTags`, `holdemStatus`, `holdemChoices` (the main button's label and the presets); the only Hold'em view code that reads the session), `index.tsx` (`holdemViews`) |
| `docks/` | `parts.tsx` (`DockHead` with your chip count, `PendingBox`, `ChipTray`), `holdem.tsx` (`HoldemDock`: why you can't act, or the tray, presets, fold and the main button), `blackjack.tsx` (`BlackjackDock`: while bets are open the chips in hand, the tray, clear/minimum and bet; once dealt each hand with double and split, then insurance and surrender; the buttons' enabled rules are the view's own, as before) |
| `host/` | `blackjack.tsx` (`BlackjackHost`: deal while bets are open; settle, pay a blackjack now, cancel the round; end the game), `holdem.tsx` (`HoldemHost`: the pot to the last player in one tap, new hand, next street, the award sheet, cancel the hand, end the game) |
| `components/` | `avatar.tsx` (`Avatar`, `AvatarArt`: the characters as SVG, `AvatarButton`), `header.tsx` (`RoomHeader`, `ConnStatus`, the sound icon), `final-card.tsx`, `rank.tsx` (`Rank`, `places`), `crown.tsx`, `join-card.tsx`, `mode-banner.tsx`, `option.tsx`, `field.tsx` (`NumField`), `sheet-head.tsx`, `toast.tsx` (`createToaster`) |
| `avatars.ts` | `AV_SET` (the characters), `validAv`, `hue`, `avatarBg`, `initial` |
| `labels.ts` | `RESULT_HE` (how a Blackjack hand ended), `STAGE_HE` (the streets; also the event line), `actionText` (a player's last action) |
| `ceremony.tsx` | `Ceremony`: the dim with the spotlight, then the winner's card (crown, each winner's `Avatar` with their pid, names, the count-up, `Rank` and the buttons) and an empty `display: contents` box the timeline rains chips into (Preact never touches its children) |
| `rotate.tsx` | `RotatePrompt` and `paintRotate(el, show)` (kept while it shows, so its animation runs on), `canLock`, `lockLandscape`, `unlockTurn` |
| `scale.ts` | `createTableScale()`: `--u` and `--tw` from the screen (see Layout), and the media queries for turning the phone |
| `photo.ts` | `avatarFromPhoto(file)`: a photo cropped and shrunk to a small JPEG data URL |

**Render.** `render()` (`src/app/render.ts`): measure `[data-k]` into `FX.rects`; `ui.paint()` (Preact patches
`#app`); scale the table; show or hide the turn-the-phone prompt; `ambiSync()`; reload into a waiting update if idle;
`ui.paintSheet()`. Preact's top-level `render` is synchronous, so the effects' contract holds (before → render →
after). Focus and the caret are not saved and restored: Preact keeps the focused element (`tests/behaviour.test.js`
checks it). `paint()` re-renders only the components: the avatar letter while you type your name, the home list of
tables, and a chip from the tray landing on your Blackjack spot. The ceremony draws `#fin` from its timers, never
inside a render.

**Events.** Every control keeps its `data-a`/`data-v`; the one delegated click listener (`src/app/dom-events.ts`) runs
the action of that name (`src/app/actions/`), and
`data-bind` inputs write the state through the one `input`/`change` listener. Inputs are controlled (`value` from the
state); Preact keeps the element, so focus and the caret stay while a render happens.

**Looks the same.** Same elements, classes, ids, `data-k` keys and attributes as the strings had. Where the strings had
one run of text, the component builds one string (two adjacent text nodes are kerned differently). The page and the
landscape side panel have `overflow-anchor: none` (`base.css`): the browser's scroll anchoring would otherwise start
moving the page once elements are kept rather than replaced. The side panel's scroll save/restore is gone (the panel is
kept). One visible change: a sheet keeps its scroll when it re-renders (it used to jump to the top on every tap).
Part B: the Blackjack table's elements are kept too (each seat keyed by its player, so a seat stays with its player
when someone sits down), so animations on them run to the end instead of being cut by the next render: the dealer's
nod, the bump of a spot, the glow of your empty spot and the blink, whose rhythm no longer jumps on each update.
Part C: the same for Hold'em (rows keyed by player; the dealer's nod and blink run on). The string views' whitespace
between elements (text nodes inside `.stage`, `.table`, `.host`, `.btns`, `.dock-in`) is gone; those are block, grid
or flex containers, where such whitespace draws nothing, and the boxes compared with the old build are identical.

**Per game.** `gameMode(room.game)` (`src/games/registry.ts`) answers the screens' per-game questions: the name, the
form's limit fields and "I play too" default, whether the dealer is the house (Blackjack join card), break (Hold'em
players sheet), the cancel sheet's wording and action, and what to settle before ending the game. `views` holds the
game's `Table`, `Dock` and `HostPanel` (`GameViews`): components that read the session through their selectors, like
the sheets (`src/ui/tables/blackjack/index.tsx`, `src/ui/tables/holdem/index.tsx`).

## Effects

Every animation, sound effect and narration line that follows a table change comes from the change itself, on every
phone: documents → events → subscribers (Observer). Nothing is stored for it.

1. **Diff.** A snapshot arrives and is normalised. `diffRoom(oldRoom, newRoom, { myId, players })` or
   `diffPlayers(oldPlayers, newPlayers, room, { myId })` (`src/sync/diff.ts`, pure, unit tested) returns the
   `DomainEvent[]` (`src/sync/domain-events.ts`). A player whose `ts` changed did `lastAction.k`, read with the rules of
   the room's game; the room's events come from `closed`, `phase`, `roundId`, `roundEnd`, `handId`, `stage`. Nothing is
   sent for a phone's first copy of a document (old = empty: a phone joining mid-hand doesn't replay it), when `ts` is
   unchanged, or for a table the guard refuses. Each event carries what its effect needs (pid, `mine` = it is this
   phone's player, amounts, spot index, the chips before and after).
2. **Before.** `bus.emit(events, commit)` (`src/sync/events.ts`) runs every subscriber's `before(event)`: this is where
   an effect sets `FX.ov[pid]` (what that player's spots and stack should still look like, `setOv`) and reads
   positions from before the render (`oldRect`). What `before` returns is handed to `after`.
3. **Render.** `commit` stores the new documents in `S` and calls `render()`, which first measures every `[data-k]`
   element into `FX.rects` (positions *before* this render), then redraws (the views draw the overrides).
4. **After.** Every subscriber's `after(event, prepared)` runs: `fly()` moves chip stacks on `#fx` (page coordinates)
   from old to new positions, and on landing clears the override (`clearOv`) and renders again; sounds and narration
   play.

Events run in order (the room's: the ceremony first), and for one event the subscribers in the order `main.ts`
subscribed them: animations and their sounds (`src/fx/`) before the narration (`src/audio/narration.ts`). A subscriber
that throws is logged and skipped; the others run.

| Event | From | Effect (`src/fx/`) | Narration |
|---|---|---|---|
| `BetPlaced` | Blackjack `bet`, the spot grew | Others: chips (just the added ones when the stored stacks allow) fly seat → spot 0, the spot shows the old bet until they land. Yours: the spot bumps | |
| `BetCleared` | `clear` | Spot → seat, fading | |
| `HandDoubled` | `double` | The second half flies next to the spot, `×2` | |
| `HandSplit` | `split` | One half slides over, the other comes from the seat, `ספליט` | |
| `InsuranceTaken` | `ins` | Seat → insurance spot | |
| `Surrendered` | `surrender` | Half the bet spot → seat | |
| `BlackjackPaid` | `bjpay` (always sent) | Dealer nod, `בלאק ג'ק!`, 3:2 from the dealer, all to the seat | `blackjack` (400 ms) |
| `HandsSettled` | `bjres` | Lost bets to the dealer, wins from the dealer, everything to the seat, the net over the seat; your result sound | |
| `RoundRefunded` | `refund` with the spots emptied (cancelled round) | Every unpaid bet and the insurance back to the seat | |
| `Refunded` | `refund` otherwise (the dealer's correction) | Dealer → seat (or seat → dealer when taken) | |
| `BlindPosted`, `Called`, `BetMade`, `Raised`, `WentAllIn` | Hold'em `blind`, `call`, `bet`, `raise`, `allin` | Seat → pot when the stack went down (`WentAllIn` is sent even when it didn't) | `allin`, once per hand (350 ms) |
| `Checked`, `Folded` | `check`, `fold` | Knock; fold sound | |
| `PotWon`, `HandRefunded` | `won`, `refund` (stack went up) | Pot → seat; a win bumps the seat and plays your win sound | |
| `GameEnded` | `closed` on with `final` | The ceremony (`src/app/ceremony.ts`) | `winner` at the reveal (inside the ceremony) |
| `BetsLocked` | Blackjack `betting` → `playing`, same round | Bell, dealer nod, every spot in the round bumps | `locked` |
| `RoundPaid` | `playing` → `betting`, next round, `roundEnd: 'paid'` (or the event text when an older phone paid) | | `payout`, `open` 2.5 s later |
| `HandStarted` | Hold'em `handId` up | Bell, dealer nod | `newhand` |
| `StreetDealt` | `stage` became `flop`, `turn` or `river` | | the street |

`data-k` keys: `seat:<pid>`, `spot:<pid>:<i>`, `ins:<pid>`, `dealer`, `pot`, `mystack`, `pend`, `ghost`.

Effects that aren't document changes stay with the app: the chip flying from the tray into your hand (`add`,
`src/app/actions/chips.ts`), the ceremony's timeline, the closed sign dropping, and the `closed` line on "לשולחן".

## Layout

The blackjack table is a box with `aspect-ratio: 100/98`. `--u` is 1% of its width, set from JS (`src/ui/scale.ts`, on every render and resize),
so the whole table scales as one picture. Seats, betting circles and the printed text sit on ellipses with
one shared centre near the dealer (`GEO` in `src/ui/tables/blackjack/geometry.ts`); seats are spaced by arc length
(the arc measured once, `seatLayout`) so circles never overlap; split hands sit side by side, smaller (`spotsAt`). In landscape (`@media (orientation: landscape)`) the room becomes two columns: a side panel
(header, your chips, dealer controls) and the table sized by the screen height.

## Sound

The sound is in `src/audio/`. `createSound()` (`synth.ts`, the `SND` the app is given) owns one AudioContext created on
the first touch (browsers require it; `startAudioControl()` in `control.ts` listens for it). Effects are synthesized:
clay-chip clacks are short band-passed noise plus a click; the bell, drumroll, fanfare and applause are
oscillators and filtered noise. The settings live there too (`chips.sound`, `chips.ambi` → `SND.ambiOn`/`setAmbi`,
`chips.voice` → `SND.voiceOn`/`setVoice`). `ambiSync()` (`control.ts`, called on every render and when the screen
turns on or off) starts or stops the background.

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
`Ambience`, `loopBounds` and the manifest are in `src/audio/ambience.ts`, the engine's background control
(`ambiStart`, `ambiStop`, loading the clips) in `synth.ts`. Measured by `node tests/audio.js`: bed about −41 dBFS,
loudest 50 ms about −23 dBFS. The header speaker, `ambiSync`
rules and the 6 dB ducking under narration apply to both. Every 45–120 s a synthesized "someone plays with their
chips" sound plays on top.

**Narration.** `SND.say(key)` (the voice is `createVoice()` in `src/audio/narration.ts`) plays
`sounds/voice/<key>.mp3` (`open locked blackjack payout winner newhand flop turn river allin closed`), loaded together
the first time a table is open. One line at a time: a new one is dropped while one plays, except `winner` and `closed`,
which wait. The background bus is ducked 6 dB meanwhile. Level about −20 dBFS RMS (`VOICE_LEVEL`). Settings has a
separate switch (`chips.voice`, default on); the header speaker mutes all.
Triggers run on every phone, not only the acting one: `subscribeNarration()` subscribes to the events (see the table in
Effects): `BetsLocked` → `locked`; `RoundPaid` → `payout`, 2.5 s later `open`; `HandStarted` → `newhand`;
`StreetDealt` → the street; `WentAllIn` → `allin`, once per hand (the hand is remembered on the phone);
`BlackjackPaid` → `blackjack`. The ceremony says `winner` at the reveal and the `finclose` action says `closed`.
Nothing is stored for this; it is all local.

## Updates

`scripts/build-config.js` writes `window.APP_BUILD` (the commit) into `config.js`. The app (`src/update.ts`) fetches
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
