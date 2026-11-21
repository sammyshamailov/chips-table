# Architecture

## `index.html`, top to bottom

The script is one IIFE. Sections are marked with `/* ---------- name ---------- */` comments, in this order:

| Section | What it does |
|---|---|
| state (`S`) | Everything the UI needs: identity (`myId`, `name`, `avatar`), current table (`code`, `room`, `players`), chips in hand (`pending`, `pendChips`), open sheet |
| casino background (`Ambience`, `loopBounds`) | Loops `sounds/casino-floor.mp3`, a real casino-floor recording. Works on any AudioContext (also offline for `tests/audio.js`) |
| sounds (`SND`) | Chip clacks, slides, bell, drumroll, fanfare, applause, results. Unlocked on first touch |
| ambience control | `ambiSync()`: the background runs only inside an open table, screen on, sound on, setting on |
| effects (`FX`, `fly`, `floatText`, `pulse`) | Flying chips on the `#fx` layer, overrides that hold the old picture until chips land |
| staying up to date | Compares `APP_BUILD` with the live `config.js` and reloads when idle |
| avatars | Prepared characters (`AV_SET`, drawn by `avSVG`), photo processing, `avInner()` for every avatar circle |
| local single-device store | `LocalDB`, same surface as Firestore, in localStorage |
| connect | Picks Firestore or `LocalDB`, opens the last table |
| writes | `w(path, op, data)`: one write at a time per document, errors shown as toasts |
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
| `closed` *added* | The game is over; the table shows the final standings |
| `final {at, list:[{pid, name, stack}]}` *added* | Standings frozen when the dealer ended the game, highest first |

### `rooms/{CODE}/players/{pid}` (`p_` + 6–16 lowercase letters/digits)

| Field | Meaning |
|---|---|
| `name`, `joinedAt`, `stack`, `sittingOut` | The player |
| Hold'em: `handId`, `streetId`, `streetBet`, `committed`, `folded`, `allIn` | Per-hand state |
| Blackjack: `bjRound`, `hands[]`, `insurance`, `surrendered` | Bets of the round `bjRound` |
| `hands[i]`: `bet`, `doubled`, `split`, `result` (`win`, `bj`, `push`, `lose`, `surrender`) | One betting spot |
| `hands[i].chips` *added* | The exact chips placed, bottom to top. Used only when they add up to `bet` |
| `hands[i].paid` *added* | A blackjack the dealer paid mid-round. The payout and a cancelled round skip it |
| `lastAction {k, amt, chips?}`, `ts` | The last thing that happened to this player; drives the animations |
| `avatar` *added* | `{k:'set', v:'<id from AV_SET>'}` or `{k:'img', v:'data:image/jpeg;base64,…'}` (about 5–14 KB), or `null` |

`lastAction.k` values: Hold'em `blind`, `check`, `call`, `bet`, `raise`, `allin`, `fold`, `won`, `refund`;
Blackjack `bet`, `clear`, `double`, `split`, `ins`, `surrender`, `bjpay` *added*, `bjres`, `refund`.

Writes that don't set `lastAction`/`ts` (avatar changes, sitting out) don't animate.

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

The background is a recording (`sounds/casino-floor.mp3`, CC0, see `sounds/CREDITS.md`). It is fetched the
first time the background is wanted, decoded once, and looped at `BG_LEVEL` (about −32 dBFS). `loopBounds`
trims any decoder silence and crossfades 50 ms at the seam so the loop has no click. Each phone starts at a
random point. Every 45–120 s a synthesized "someone plays with their chips" sound plays on top.

## Updates

`scripts/build-config.js` writes `window.APP_BUILD` (the commit) into `config.js`. The app fetches
`config.js` (no cache) when it comes back to the screen, on focus, when back online and every 3 minutes.
On a different build it reloads as soon as the player has no chips in hand, no sheet open and isn't typing;
otherwise it shows a "יש גרסה חדשה" button. Phones running a version from before this existed need one
manual restart.
