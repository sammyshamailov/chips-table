# Roadmap

Every planned update and fix, each with a plan detailed enough to pick up cold. This is the place to
write an idea down before working on it, and to keep the plan honest while it is being built.

- **Planned work lives here.** What already shipped lives in `CHANGELOG.md`; bugs that taught us a rule
  live in `lessons-learned.md`.
- **One entry per change.** A change that a player would describe as one thing ("avatars", "the payout
  lost my chips") is one entry, even if it touches many places.
- **Plan first, then build.** Fill in the plan before writing code. If the build shows the plan was wrong,
  fix the plan in the same commit as the code.
- **Read `CLAUDE.md` and `lessons-learned.md` before planning** anything that touches start-up,
  rendering, stored data, sync or sound. Most of the plan's "Risks" come from there.

## How to use this file

1. **Add** a new entry at the top of [Backlog](#backlog) by copying the [template](#entry-template).
   Give it the next free ID (`R-###`, never reused) and status `Proposed`. A one-line idea is fine at
   first; it must have a full plan before it moves to `Planned`.
2. **Plan**: fill in every section of the template. Status `Planned` means someone could build it from
   the entry alone.
3. **Build** on a side branch. Move the entry to [In progress](#in-progress), set status `In progress`
   and the branch name. Tick the steps and the test checklist as you go.
4. **Ship**: when the change reaches `main`, set status `Done`, add the date, add the `CHANGELOG.md`
   entry, and move the entry to [Done](#done) with its plan collapsed to a short summary and a link to
   the commit. Delete nothing: a dropped idea moves to Done with status `Dropped` and one line on why.

### Statuses

| Status | Meaning |
|---|---|
| `Proposed` | An idea or a reported bug. May have no plan yet |
| `Planned` | Full plan written; ready to build |
| `In progress` | Being built on a branch |
| `Blocked` | Waiting on something outside the code (the owner, Firebase console, a decision). Say what |
| `Done` | Live on `main` |
| `Dropped` | Decided against. Keep the reason |

### Priority and size

- **Priority**: `P0` money or the table is wrong for players (lost chips, a stuck table) · `P1` hurts a
  game night · `P2` nice to have.
- **Size**: `S` under an hour · `M` an evening · `L` several sessions, split it if possible.

## Entry template

Copy from `### R-###` to the closing line.

```markdown
### R-### Short title

| | |
|---|---|
| Type | Fix / Feature / Improvement / Chore |
| Status | Proposed |
| Priority | P0 / P1 / P2 |
| Size | S / M / L |
| Games | Blackjack / Hold'em / Both / — |
| Branch | — |
| Added | YYYY-MM-DD |
| Done | — |

**Problem / goal.** What is wrong or missing, seen from a player at the table. For a bug: how to make it
happen, what happens, what should happen.

**Plan.**
1. Concrete steps, naming the functions and sections of `index.html` involved (see
   `docs/ARCHITECTURE.md` for the section list).
2. …

**Stored data.** New optional fields, with the fallback every reader uses when the field is missing or
wrong. "None" if nothing stored changes. Never rename, remove or change the meaning of a field. If
`firestore.rules` would have to change, say so: the owner must paste the rules in the Firebase console.

**Effects and sound.** Does a player write set `lastAction` and `ts`? Which `fxBJ` / `fxHold` / `fxRoom`
handler animates it? New sounds: measured with `node tests/audio.js`. "None" if nothing changes.

**Risks.** What could break: start-up order (rule 2), state kept in the DOM (rule 3), money moved twice
(search every function that sums `hands` or refunds bets), phones on an older version sharing the table.

**Tests.**
- [ ] `node tests/two-phones.test.js` passes, extended with a check for this change if other players see it
- [ ] `node tests/screenshots.js`, and the screenshots looked at
- [ ] `node tests/audio.js` (only if sound changed)
- [ ] Checked by hand: …

**Docs to update.** `CHANGELOG.md`, and `docs/ARCHITECTURE.md` / `lessons-learned.md` / `README.md` if
they change.

**Done when.** The observable result that closes the entry.
```

---

## In progress

_Nothing yet._

---

## Backlog

Newest first. Entries marked *Proposed* below were found by reading the code; they are suggestions to
confirm, not commitments.

### R-004 Dealer writes to a player's stack can overwrite that player's own write

| | |
|---|---|
| Type | Fix |
| Status | Proposed |
| Priority | P0 |
| Size | M |
| Games | Both |
| Branch | — |
| Added | 2026-11-21 |
| Done | — |

**Problem / goal.** When the dealer pays or refunds, the dealer's phone writes each player's new stack
as an absolute number computed from its own copy: `stack: (p.stack || 0) + pay` in `bjPayout`,
`bjCancelRound`, `bjNow`, `award` and `cancelHand`. If the player writes in between (the copy is stale),
one of the two writes is lost.

The clearest case is `bjPayout`: it writes the room first (`phase: 'betting'`, next `roundId`) and only
then the players. A player whose phone sees the new betting phase first can place a bet (`bjBet` writes
`stack: m.stack - add`, `hands: [newBet]`, `bjRound: newRound`). The dealer's payout write then lands
with the old stack plus winnings and the old round's `hands`, keeping the new `bjRound`. Result: the bet
is never taken from the stack and the old hand appears as a bet in the new round, so chips appear from
nowhere. The window is the time between the two writes: small on good Wi-Fi, real on a slow connection.

**Plan.**
1. Reproduce it first in the two-phone harness: on phone B, delay the relay of the dealer's player
   writes (`tests/lib.js`) and bet as soon as the room shows `betting`. Add a check that the total of all
   stacks, bets and `house` is unchanged across the round. It should fail before the fix.
2. In `bjPayout` and `bjCancelRound`, write the player documents **before** the room document, so no
   player can start the next round while payouts are still in flight.
3. Change the dealer's stack writes from an absolute value to an increment
   (`firebase.firestore.FieldValue.increment(n)`): `bjPayout`, `bjCancelRound`, `bjNow`, `award`,
   `cancelHand`. Add a small helper (`inc(n)`) in the `writes` section so the call sites stay short.
4. Teach `LocalDB` (single-device store) and `tests/fakefs.js` to apply the increment sentinel, so
   single-device mode and the tests behave like Firestore.
5. Leave each player's own writes (`bjBet`, `bjDo`, `hAct`) as they are for now: they only race with the
   dealer, and the dealer no longer overwrites them.
6. Re-run the check from step 1; it should now pass.

**Stored data.** None: `stack` stays a plain number in the document. Increments are a write-time
operation, so phones on an older version read the same field.

**Effects and sound.** Unchanged: the writes keep the same `lastAction` and `ts`. Check that the payout
animation still starts from the right stacks, since the stack value the snapshot handler sees is now the
server's result.

**Risks.** `LocalDB` and `fakefs.js` must understand the sentinel or single-device mode breaks: test
both. The compat SDK loaded from gstatic (10.12.2) has `firebase.firestore.FieldValue.increment`. Changing write order must not leave a half-paid round if a write fails:
on failure, show the error and do not advance the round.

**Tests.**
- [ ] New money-conservation check in `tests/two-phones.test.js` fails before, passes after
- [ ] Single-device mode by hand: payout, cancel, mid-round blackjack, Hold'em award with a side pot
- [ ] `node tests/screenshots.js`

**Docs to update.** `CHANGELOG.md` (Fixed), `lessons-learned.md` (Stored data and sync: dealer writes
must not assume the player's document is unchanged), `docs/ARCHITECTURE.md` (writes section).

**Done when.** Betting the instant a new round opens never changes the total chips at the table.

### R-003 Two-phone test for a Hold'em hand

| | |
|---|---|
| Type | Chore |
| Status | Proposed |
| Priority | P1 |
| Size | M |
| Games | Hold'em |
| Branch | — |
| Added | 2026-11-21 |
| Done | — |

**Problem / goal.** `tests/two-phones.test.js` only plays blackjack. Hold'em (blinds, betting rounds,
side pots, cancelling a hand) has no automated check, so a sync or payout bug there would only show up
at a game night.

**Plan.**
1. Split the shared set-up in `tests/two-phones.test.js` (open table, join, seat) into a helper in
   `tests/lib.js` that takes the game type.
2. Add `tests/holdem.test.js`, three phones: dealer plus two players with different stacks.
3. Play one hand: `newHand` posts blinds → check, bet, call on each street (`hAct`, `nextStreet`) →
   `award`. Check stacks, `committed`, the pot shown on every phone, and that the button and blinds move
   on the next hand.
4. Play an all-in hand with unequal stacks so `computeAward` makes a side pot; award the main pot and the
   side pot to different players and check the amounts.
5. Cancel a hand mid-street (`cancelHand`) and check every player gets back what they put in.
6. After each step, check the total of stacks plus pot is unchanged.
7. Add it to the table in `docs/TESTING.md` and to rule 8 in `CLAUDE.md`.

**Stored data.** None.

**Effects and sound.** None; the test only watches page errors and values.

**Risks.** Timing: give each tap time for the snapshot round trip, and use selectors, not saved handles
(see `docs/TESTING.md`, Pitfalls).

**Tests.**
- [ ] `node tests/holdem.test.js` passes three runs in a row
- [ ] `node tests/two-phones.test.js` still passes after the helper is moved

**Docs to update.** `docs/TESTING.md`, `CLAUDE.md`, `CHANGELOG.md`.

**Done when.** A broken Hold'em payout or side pot fails a test.

### R-002 Hold'em: show the dealer which player is to act

| | |
|---|---|
| Type | Feature |
| Status | Proposed |
| Priority | P2 |
| Size | M |
| Games | Hold'em |
| Branch | — |
| Added | 2026-11-21 |
| Done | — |

**Problem / goal.** Any player who can act may act at any time; the app doesn't show whose turn it is.
At a busy table people act out of turn or wait for someone who already acted.

**Plan.**
1. Decide with the owner first: a hint only (highlight), or a rule (only the player to act gets the
   buttons). Start with the hint: it cannot block a game if it's wrong.
2. Compute the player to act in the Hold'em model from data already stored: seat order from
   `players()`, `buttonPid`, `bbPid`, each player's `streetBet`, `folded`, `allIn` and the current
   `maxSt` from `H()`. Preflop starts left of the big blind, later streets left of the button.
3. Highlight that seat in the Hold'em table view and show "התור שלך" in that player's dock.
4. When everyone has matched the bet or is all-in, show the dealer a hint to go to the next street.

**Stored data.** None: everything is derived from existing fields.

**Effects and sound.** Optional soft cue on your own phone when it becomes your turn; measure it with
`node tests/audio.js` and keep it under the chip sounds.

**Risks.** The derived turn can be wrong after sitting out or a player leaving mid-hand; being a hint,
it must never stop anyone acting.

**Tests.**
- [ ] Hold'em test (R-003) checks the highlighted seat through one hand
- [ ] Screenshots in portrait and landscape

**Docs to update.** `CHANGELOG.md`, `docs/ARCHITECTURE.md` (Hold'em flow), `README.md` if play changes.

**Done when.** At every point of a hand, the right seat is highlighted on every phone.

### R-001 Planning file

| | |
|---|---|
| Type | Chore |
| Status | Done |
| Priority | P2 |
| Size | S |
| Games | — |
| Branch | `ccr-74add77c-f7qmcg` |
| Added | 2026-11-21 |
| Done | 2026-11-21 (branch) |

**Problem / goal.** No single place to plan upcoming updates and fixes.

**Plan.** Add `ROADMAP.md` with the workflow, statuses, an entry template and the first proposed
entries; point to it from `CLAUDE.md`; keep it off the public site in `netlify.toml`.

**Done when.** New work starts as an entry here. _(Moves to Done once on `main`.)_

---

## Done

Newest first. Short summary, date it reached `main`, commit.

_Nothing yet._
