# Architecture

## `index.html`, top to bottom

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
| chips | Denominations, `chipsOf`, `stackHTML`, exact-chip helpers |
| change → animation | `fxPlayers`, `fxBJ`, `fxHold`, `fxRoom`, `lockFx` |
| Hold'em model / Blackjack model | Game rules and the writes for each action |
| create / join | New table, join, claim a seat |
| turn-the-phone prompt | Shown inside a table on a phone held upright |
| end of the game | Standings, `endGame`, `ceremony`, final card, closed sign |
| dealer figure | `dealerSVG`, `dealerNod` |
| views | `render()`, home, room, Hold'em and Blackjack tables, docks, host panels, sheets |
| events | `A` (all `data-a` actions), click/input handlers |

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
| `dealerTap` *added* | Number: the time of the last tap by a dealer who isn't seated (the same button in the dealer controls). Missing or not a number = never. Read by `fxRoom` only; written alone |
| `closed` *added* | The game is over; the table shows the final standings |
| `final {at, list:[{pid, name, stack}]}` *added* | Standings frozen when the dealer ended the game, highest first |

**Guard for unknown table types.** `tableUnsupported(room)` (index.html, next to `now`) is true when `appMin > FEATURE_LEVEL`
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
| `tap` *added* | Number: the time of this player's last press of the tap button (Blackjack, R-016). Written alone (never with `lastAction`/`ts`). Missing or not a number = never tapped. Readers: `fxTaps` only |
| `lastAction {k, amt, chips?}`, `ts` | The last thing that happened to this player; drives the animations |
| `avatar` *added* | `{k:'set', v:'<id from AV_SET>'}` or `{k:'img', v:'data:image/jpeg;base64,…'}` (about 5–14 KB), or `null` |

`lastAction.k` values: Hold'em `blind`, `check`, `call`, `bet`, `raise`, `allin`, `fold`, `won`, `refund`;
Blackjack `bet`, `clear`, `double`, `split`, `ins`, `surrender`, `bjpay` *added*, `bjres`, `refund`.

Writes that don't set `lastAction`/`ts` (avatar changes, sitting out) don't animate. The one exception is `tap`, which has its own diff (see Effects).

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
contribution level) or `cancelHand`.

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

**Taps (R-016).** A press writes only `{ tap: now() }` to your player document (`doTap`; an unseated dealer writes
`{ dealerTap }` to the room). `fxPlayers` calls `fxTaps(old, new, room)` first, which runs for every player,
independent of the `ts` check: it plays when the game is Blackjack and not closed, the old document existed
(so the first snapshot of a table, a reload or a late join never replays anything), `typeof tap === 'number'`
and `tap` is greater than the old one. `fxRoom` does the same for `dealerTap`. The pressing phone plays its own
hand from the snapshot too, so it is exactly once everywhere. `handTap(pid, dealer)` draws the hand on `#fx`
(WAAPI, removed when done): `tapGeom` picks the landing point between the seat and its first betting spot (for
the dealer, below the rack) and the direction the arm comes from (away from the table centre); the fist or palm
(`handSVG`, three variants and skin/sleeve colours by a hash of the pid, `--u` sized) slides in, hits 3-4 times
(down fast, up slower, random timing and angle; the scale change is the "up and down" seen from above), the chips of
that player's `spot:<pid>:*` jump 1-2 px on each hit, and it slides out; about 1.5 s. At most `TAP_MAX` (4)
hands at once, extras are skipped; several start 35 ms apart. A seat that is off screen or under the dock gets the
sound only; with reduced motion (`RM`) the seat (or rack) shakes instead. A hidden page plays nothing. The button
cooldown is `S.tapAt` (`TAP_GAP` 2000 ms, never in the DOM): the button renders disabled and a timer re-renders when it ends; a press
during the cooldown writes nothing. Everything `render()` reaches (`tapButton`, `tapCooling`, `HAND_ICON`) is above the local-store section.

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

**Tap knocks.** `SND.hand(seed, times)` schedules one `thump` per hit (`times` are the animation's hit times in
seconds): a sine body gliding down from 160-250 Hz to 60-100 Hz (by player), a short triangle overtone and 30 ms of low-passed
noise, a little different on every hit, pitched by `seed` (0..1 from the pid) so several hands sound like several
hands. Respects the speaker button (`ready()`). Level: peak about -21 dBFS at the master against about -17 for four chip
clacks (`node tests/audio.js` prints both through `SND.offline`, a test hook that points the synth at an offline context).
(`SND.tap` is the older buzz of a dealer button; the hand is `SND.hand`.)

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
