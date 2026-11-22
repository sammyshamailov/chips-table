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

1. **Add** a new entry to [Backlog](#backlog) by copying the [template](#entry-template), in the place its
   priority and dependencies put it (the backlog is in build order, not ID order).
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

### R-001 Planning file

| | |
|---|---|
| Type | Chore |
| Status | In progress |
| Priority | P2 |
| Size | S |
| Games | — |
| Branch | `ccr-74add77c-f7qmcg` |
| Added | 2026-11-21 |
| Done | — |

**Problem / goal.** No single place to plan upcoming updates and fixes.

**Plan.** Add `ROADMAP.md` with the workflow, statuses, an entry template and the first proposed
entries; point to it from `CLAUDE.md`; keep it off the public site in `netlify.toml`.

**Done when.** New work starts as an entry here. _(Moves to Done once on `main`.)_
The v2 plans (R-005 to R-014) were added on the same branch on 2026-11-22.

---

## Version 2

The owner's list from 2026-11-22, turned into entries. Nothing here is built yet. Each entry has a full
plan, written to the owner's [decisions](#decisions).

**Start with #1 and go down.** Each step ends live on `main` (when you say so) before the next one
starts, so the table keeps working between steps. "Decided by" lists the [decisions](#decisions) the step
follows.

| # | Entry | Owner's item | Decided by | Why here |
|---|---|---|---|---|
| 1 | [R-004](#r-004-dealer-writes-to-a-players-stack-can-overwrite-that-players-own-write) Fix the dealer write race | — | — | Live bug: chips can appear from nowhere at tonight's table. Small, and the players are on `main` now |
| 2 | [R-003](#r-003-two-phone-test-for-a-holdem-hand) Hold'em two-phone test | 3, 7 | — | The safety net: without it the refactor and the new Hold'em table can break Hold'em unnoticed |
| 3 | [R-009](#r-009-guard-older-phones-against-new-table-types) Guard older phones against new table types | 2 | — | Tiny, but it has to be on every phone well before the first card table, so it goes out early |
| 4 | [R-005](#r-005-code-foundations-modules-layers-tooling) Code foundations | 7 | Q2 | Everything below builds on it; doing it later means writing each feature twice |
| 5 | [R-006](#r-006-english-and-hebrew) English and Hebrew | 1 | Q4, Q10 | Every later feature then adds its text in both languages once, instead of being translated afterwards |
| 6 | [R-007](#r-007-holdem-table-on-par-with-blackjack) Hold'em on par with Blackjack | 3 | — | Improves the game you already play, and its table, turn logic and pot animations are what card Hold'em reuses |
| 7 | [R-016](#r-016-tapping-on-the-table) Tapping on the table | (new) | Q11, Q12 | Small and fun, works in today's chips mode; needs the seats R-007 adds to the Hold'em table. The card-mode trigger is added with R-011 / R-013
| 8 | [R-010](#r-010-card-mode-core-the-app-deals) Card mode core | 2 | Q1, Q3 | The engine both card games stand on: dealing, hidden cards, the host running the game |
| 9 | [R-011](#r-011-blackjack-with-cards) Blackjack with cards | 2 | Q7 | The simpler card game first: few hidden cards, no hand ranking. Proves the engine at a real table |
| 10 | [R-013](#r-013-card-animations-and-sounds) Card animations and sounds | 4 | Q9 | Built together with R-011 (the card mode feels flat without them); the Hold'em motions are added in R-012 |
| 11 | [R-012](#r-012-holdem-with-cards) Hold'em with cards | 2, 3 | Q8 | The hardest game logic (best hand, side pots, turns), on a proven engine and the R-007 table |
| 12 | [R-008](#r-008-table-statistics) Table statistics | 6 | Q6 | After both modes exist, so every number is designed once for chips and cards instead of retrofitted |
| 13 | [R-014](#r-014-voice-messages) Voice messages | 5 | Q1, Q5 | Voice messages: independent of the rest, and useful for remote players (Q1) |
| 14 | [R-015](#r-015-live-voice-chat) Live voice chat | 5 | Q1, Q5 | Later, as decided; builds on R-014's microphone and playback |
| ? | [R-017](#r-017-lock-down-who-can-change-the-table) Lock down who can change the table | (fix) | Q13 | Proposed. If wanted, it goes before the card mode (step 8)

The reasoning in short: **fix what's broken for players today** (1), **put the safety nets in place**
(2, 3), **rebuild the foundations once** (4), then **improve what players already use** (5, 6),
then a small fun addition (7), then **the big new mode** (8–11), then what builds on everything (12)
and voice (13, 14).

Rough size: steps 1–3 are a few evenings together; 4 is the longest single step; 8–11 together are the
largest part of the whole plan.

### Constraints every v2 entry keeps

- **Everything stays free.** Firebase stays on the free Spark plan, which has no server code (Cloud
  Functions) and no file storage (Cloud Storage): both need the paid Blaze plan. The one piece that needs
  a server, the card dealer (R-010), runs on Vercel's free Hobby plan, separate from the Netlify site so
  it can never take the site down.
- **No new Firestore collections** (`firestore.rules` would have to be pasted again). New data goes into
  `rooms/{CODE}` and `rooms/{CODE}/players/{pid}` as optional fields.
- **The chips-only mode stays exactly as it is** for players, and its stored data keeps its meaning.
- **Free quota**: Spark allows 50,000 document reads and 20,000 writes a day. Every write is one read
  per phone listening. A busy night of the card mode could get near the read limit, so each card-mode
  entry measures writes per hand in the tests (see R-010).

### Decisions

The owner's answers of 2026-11-22. The entries below follow them.

| # | Question | Decision |
|---|---|---|
| Q1 | Where are the players? | **Both**: the same room and different places. Card mode and voice must work for remote players |
| Q2 | Build step | **Move to Vite + TypeScript + Preact** (R-005) |
| Q3 | How hidden must cards be? | **A small free dealer service on Vercel holds the deck**, so no phone knows a card before it is dealt; Firebase stays for syncing the table (R-010, "Where the deck lives") |
| Q4 | Spoken voice | **The Hebrew dealer narration already on `main`** (11 recorded lines) gets an English version, and new lines come in both languages (R-006, R-013) |
| Q5 | Voice chat | **Voice messages now** (R-014); **live voice later** (R-015) |
| Q6 | Statistics scope | **Per table only** (R-008) |
| Q7 | Blackjack rules | **The host can change every listed rule** when opening a card table (R-011) |
| Q8 | Hold'em turn timer | **Off by default; the host can set 30 or 60 seconds** (R-012) |
| Q9 | Your own cards | **Hold'em: face down, with a "Show my cards" button that keeps them up. Blackjack: always face up** (R-011, R-012) |
| Q10 | English app name | **Yes: "Chips"** for the English version (R-006). Say if you prefer another |
| New | Blackjack double down | **The player chooses face up or face down** when doubling, in the card mode. Face down means nobody looks, the player included, until the dealer settles (R-011, R-013) |
| New | English narration voice | **Claude picks a clear English voice and sends the owner a preview** before it ships (R-006) |

### Still open

- **Q11. Tapping in Hold'em with cards.** Your hole cards are secret, so the table can't tap when *you* get
  an ace without giving it away. *Default:* in Hold'em the table taps when the first card of the flop is
  an ace; in Blackjack when any player's first card is an ace.
- **Q12. The tap button in the card mode too?** *Default:* yes, the button is in both modes; the card
  mode also taps by itself on an ace.
- **Q13. Lock down who can change the table** (R-017)? *Default:* not now; decide before the card mode.

---

## Backlog

In the order to build them, most important first (see [Version 2](#version-2)). R-003 and R-004 were
found by reading the code.

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

*Note:* ship this alone, first: it is live. R-005's data layer later keeps the `increment` helper.

### R-003 Two-phone test for a Hold'em hand

| | |
|---|---|
| Type | Chore |
| Status | Planned |
| Priority | P1 |
| Size | M |
| Games | Hold'em |
| Branch | — |
| Added | 2026-11-21 |
| Done | — |

**Problem / goal.** `tests/two-phones.test.js` only plays blackjack. Hold'em (blinds, betting rounds,
side pots, cancelling a hand) has no automated check, so a sync or payout bug there would only show up
at a game night. It is also the safety net for the refactor (R-005) and the Hold'em table (R-007), so
it comes before both.

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

### R-009 Guard older phones against new table types

| | |
|---|---|
| Type | Chore |
| Status | Planned |
| Priority | P1 |
| Size | S |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** A phone on today's version that opens a card-mode table would show it as a chips table
and could place chip bets into it. Before any card table exists, every phone must know how to refuse a
table it doesn't understand.

**Plan.**
1. Add `FEATURE_LEVEL = 1` to the app. New optional room fields: `mode` (`'chips'` or `'cards'`; missing
   means chips) and `appMin` (the lowest feature level that can play this table; missing means 0).
2. On opening a table: if `appMin > FEATURE_LEVEL` or `mode` is unknown, show "This table needs a newer
   version" with an Update button (runs the self-update check and reloads), and never write to it. The
   home screen's table list marks such tables the same way.
3. Ship this to `main` right after R-004 and R-003 (it is small and independent) so that by the
   time card tables exist, every phone has updated past it.
4. **For phones older than the guard**: card tables also set the old fields to values today's code
   refuses to act on: Blackjack `phase: 'cards'` (today's bet and play code only act on `betting` and
   `playing`), Hold'em `stage: 'cards'` (today's code only acts on the four betting streets). Such a phone
   sees a frozen table instead of making wrong writes.

**Stored data.** Adds optional room `mode` and `appMin`. Fallbacks as above.

**Effects and sound.** None.

**Risks.** Step 4 depends on today's checks; verify by opening a card table with the current `main`
build in the harness.

**Tests.**
- [ ] Harness: a table with `appMin: 99` shows the update screen and makes no writes
- [ ] Harness: today's `main` build on a table with `phase: 'cards'` cannot bet

**Docs to update.** `docs/ARCHITECTURE.md`, `CHANGELOG.md`, `lessons-learned.md` ("new table types need
a guard shipped first").

**Done when.** No phone, old or new, can write to a table type it doesn't understand.

### R-005 Code foundations: modules, layers, tooling

| | |
|---|---|
| Type | Chore |
| Status | Planned |
| Priority | P1 |
| Size | L (six phases, each shippable) |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** Everything is one 1,850-line `index.html`: styles, data, rules, views, sounds and
animations share one scope. It works, but each new feature touches everything, and the start-up order
trap (rule 2) has bitten three times. Before adding languages, a second game mode and voice, split the
app into small modules with clear jobs, so each feature lives in its own place and the game rules can be
tested without a browser. Players must see no difference.

**Decision (Q2).** Vite + TypeScript + Preact. Reasons: types catch the "field is missing
or wrong" class of bug that rule 1 guards against; Preact updates the page instead of replacing it, which
removes the causes behind rule 3 (lost scroll, restarted animations, detached file inputs); Vite gives
module bundling, hashed file names for caching, and a dev server. Netlify already runs a build command.

**Target structure.**

```
src/
  main.ts                 composition root: builds the store, i18n, audio, mounts the app (no work at import time)
  domain/                 pure TypeScript: no DOM, no Firebase, no timers. Fully unit tested
    chips.ts              denominations, chipsOf, exact-stack helpers
    blackjack/            rules.ts (payouts, eligibility), actions.ts (bet, double, split… → patches)
    holdem/               rules.ts (blinds, turn, min raise), pots.ts (side pots = today's computeAward)
    cards/                deck, shuffle, hand values (R-010)
    stats/                counters per game and mode (R-008)
  data/
    store.ts              Store interface: doc(), collection(), onSnapshot, update, increment
    firestore-store.ts    adapter over the Firebase compat SDK
    local-store.ts        today's LocalDB (single-device mode)
    schema.ts             types for room and player documents + normalize(): every fallback in one place
    writes.ts             the per-document write queue (today's w())
  sync/
    room-session.ts       listeners for the room and its players, connection state
    diff.ts               old/new documents → domain events (BetPlaced, HandPaid, StreetEnded…)
    events.ts             a small typed event bus
  fx/                     chip (and later card) animations, subscribed to domain events; the #fx layer
  audio/                  synthesized effects, background player, narration (SND.say), (later) voice messages
  i18n/                   catalogs and t() (R-006)
  ui/
    app.tsx, screens/     Home, Room, Closed
    tables/               BlackjackTable, HoldemTable, Seat, BetCircle, ChipStack, Pot, DealerFigure
    docks/, sheets/       one component per sheet (Players, Settings, Award, Settle…)
    components/           Button, Segmented, Field, Avatar, Toast
  games/
    registry.ts           { holdem, blackjack } × { chips, cards } → a GameMode object
```

**Design patterns, and where.**
- **Ports and adapters** for data: the app talks to a `Store`; Firestore, single-device and the test
  fake are adapters. Swapping or mocking storage touches one file.
- **Pure domain functions** (command → patch): `blackjack.double(state, playerId, handIndex)` returns
  the writes to make, or a refusal reason. No I/O, so every rule gets a unit test.
- **Strategy** per game and mode: a `GameMode` interface (`view`, `dock`, `hostPanel`, `actions`,
  `fx`, `statsSpec`). The room screen asks the registry instead of `if (game === 'holdem')` in 20 places.
- **Observer**: snapshots become typed domain events; animations, sounds, statistics and the dealer's
  nod subscribe to the events they care about.
- **Anti-corruption layer**: `normalize()` turns any stored document (old or new version) into a
  complete typed object with fallbacks, so the rest of the code never checks for missing fields.
- **Composition root**: `main.ts` creates everything explicitly. No module does work when imported, so
  the start-up order trap (rule 2) disappears.

**Conventions.**
- TypeScript `strict`. ESLint (typescript-eslint, recommended rules) + Prettier, run in CI.
- One concern per file; files under ~300 lines, functions under ~40; no default exports; named,
  descriptive identifiers; no magic numbers in rules (constants in the domain module).
- Domain code never imports from `ui/`, `data/`, `fx/` or `audio/` (enforced by an ESLint import rule).
- Components get data through props; only screens read the session.
- Comments explain *why*; JSDoc on every exported domain function.
- Commits: one logical change each, imperative subject (as today).

**Plan.** Each phase ends with every test green and screenshots unchanged, and can go to `main` alone.
1. **Tooling, same behaviour.** Add `package.json`, Vite, TypeScript, ESLint, Prettier, Vitest. Move the
   CSS to `src/styles/*.css` and the script into `src/legacy.ts` *unchanged* (typed loosely). Netlify
   build: `node scripts/build-config.js && vite build`; publish `dist/`. `sounds/` (background and
   narration MP3s) is copied as-is through Vite's `public/` folder, so its paths don't change. `sw.js` gets its file list from
   the build (hashed names) instead of the hand-written `SHELL`. Keep `config.js` loading as it is so the
   self-update keeps working. Add a screenshot comparison to `tests/screenshots.js` (pixel diff against
   images taken before the change) so "looks the same" is checked, not eyeballed.
2. **Domain out.** Move chips, Hold'em rules, side pots and Blackjack rules into `src/domain/` as pure
   functions; the old code calls them. Unit tests for each (payouts, side pots with 3+ all-ins, split and
   double limits, the `paid` hand rules).
3. **Data layer.** `Store` interface, the three adapters, `schema.ts` with `normalize()`, the write
   queue, and `increment` (finishes R-004 if not done). Move `tests/fakefs.js` behind the same interface.
4. **Events and effects.** Replace `fxPlayers` / `fxRoom` branching with `diff.ts` → events → `fx/`
   subscribers. Same animations, same timings.
5. **UI components.** Mount Preact at `#app`. Convert screen by screen (home, sheets, Blackjack table,
   Hold'em table); a temporary `<LegacyHtml>` wrapper lets an unconverted part keep its HTML string.
   Remove the `FX.rects` measuring hacks only once the component version is proven by the screenshots.
6. **Clean-up and CI.** GitHub Actions on every push: lint, typecheck, unit tests, two-phone and
   Hold'em tests, screenshots. Delete `legacy.ts`. Rewrite `docs/ARCHITECTURE.md` for the new layout.

**Stored data.** None. Phones on the old single-file version and the new build share tables.

**Effects and sound.** Unchanged, by design. Phase 4 moves them; the tests and screenshots prove it.

**Risks.**
- A big refactor of a live app: hence the phases, each shipped separately, each behind the full test set.
- The self-update and service worker: hashed files change the cache list; test a phone upgrading from the
  old version to the new build (old service worker → new) before phase 1 reaches `main`.
- Netlify publish folder changes to `dist/`: the redirects that hide dev files become unnecessary (dev
  files are no longer published); check `config.js` is still produced next to `index.html`.
- Phase 5 (UI) is the largest; if it drags, phases 1–4 already deliver most of the value.

**Tests.**
- [ ] Unit tests (Vitest) for every domain module; aim for full branch coverage of payouts and pots
- [ ] `node tests/two-phones.test.js` and the Hold'em test (R-003) after each phase
- [ ] Screenshot comparison shows no difference after each phase
- [ ] Upgrade path checked by hand: a phone on today's version updates itself into the new build
- [ ] Single-device mode by hand

**Docs to update.** `CLAUDE.md` (files, rules 2 and 3 rewritten for the new structure, running locally
with `npm run dev`), `docs/ARCHITECTURE.md` (rewritten), `docs/TESTING.md`, `README.md` (deploy),
`lessons-learned.md`, `CHANGELOG.md`.

**Done when.** `index.html` is a shell, the app is built from `src/`, CI runs every test on every push,
and no player notices anything changed.

### R-006 English and Hebrew

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P1 |
| Size | L |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** The app is Hebrew only: about 210 lines of `index.html` contain Hebrew, the page is
fixed right-to-left, and some text is *stored* in the table (the event line under the header). Each
player should choose English or Hebrew on their own phone, and players with different languages must be
able to share a table. More languages should only need a new catalog file.

**Decisions (Q4, Q10).** Everything with words follows the language: text, the words that float over the
table, and the dealer's narration (`SND.say`, 11 recorded Hebrew lines in `sounds/voice/` since the
2026-11-21 release). The English version of the installed app is called "Chips".

**Plan.**
1. **Catalogs.** `src/i18n/he.ts` and `src/i18n/en.ts`, keys grouped by screen (`home.join`,
   `bj.split`, `fx.blackjack`). TypeScript makes the English catalog fail to compile if a key is
   missing. `t(key, params)` with `{name}` placeholders; plurals through `Intl.PluralRules` (Hebrew has
   singular/dual/plural forms; English one/other).
2. **Extract every string**, including `aria-label`s, toasts, error messages (`handleErr`), the words on
   the felt (`arc()` text), floating texts (`ספליט`, `בלאק ג'ק!`, `תיקו`), the closed sign, the ceremony,
   stage names (`STAGE_HE`), and the default player name. A script fails CI if any Hebrew letter remains
   outside `he.ts`.
3. **Choosing the language.** Per phone, saved in localStorage (`chips.lang`). First run: Hebrew if the
   phone's languages list Hebrew first, otherwise English. A switch on the home screen (top corner: "EN /
   עב") and in Settings. Switching re-renders at once, also inside a table.
4. **Direction.** Set `<html lang dir>` from the language. Convert the ~30 physical CSS `left`/`right`
   rules that are about text flow to logical properties (`inset-inline-start`, `margin-inline-end`,
   `text-align: start`). The table itself is a picture and is **not mirrored**: seats, dealer and chip
   rack stay where they are in both languages. Keep the existing direction isolates (`⁦…⁩`)
   around numbers and names inside sentences.
5. **Numbers.** `fmt` already uses `en-US` grouping; keep digits Latin in both languages (as today), but
   route all formatting through one `i18n.formatChips()` so it can change per language later.
6. **Stored text (rule 1).** `lastEvent.t` is a sentence in the writer's language today. Add optional
   `lastEvent.key` and `lastEvent.p` (the parameters); every writer sets them *and* still writes `t`
   (in Hebrew, so phones on older versions keep showing a sentence). Readers show `t(key, p)` and fall
   back to `t` when `key` is missing or unknown. Names stay as typed.
7. **Fonts and layout.** Check the font stack covers Latin well; English strings run longer: check every
   button and the landscape side panel in English at the small-phone size.
8. **Copy.** English: short, plain, sentence case, the same tone as the Hebrew. Hebrew stays
   gender-neutral (rule 7). A glossary of game terms in both languages (bet, stand, split, blind, pot,
   side pot…) at the top of `en.ts` so terms stay consistent.
9. **Narration in both languages.** Move the Hebrew lines to `sounds/voice/he/` and add
   `sounds/voice/en/` with the same 11 keys (`open locked blackjack payout winner newhand flop turn river
   allin closed`) in English ("Place your bets", "No more bets", "Blackjack!", "Paying the winners", "We
   have a winner!", "New hand", "Flop", "Turn", "River", "All in!", "The table is closed. Thanks for
   playing!"). Generated with ElevenLabs in a clear English voice Claude picks (decided), one take per line, trimmed and
   normalised the same way as the Hebrew (`sounds/CREDITS.md` lists the steps); **send the owner a preview
   before shipping**. `SND.say(key)` loads the phone's language and falls back to the Hebrew file if an
   English one is missing. Measure with `node tests/audio.js` (about −20 dBFS, as now). Every later
   narration line is made in both languages at once.
10. **Installed app name.** Two manifests (`manifest.he.webmanifest` "צ'יפים", `manifest.en.webmanifest`
    "Chips"); the page points `<link rel="manifest">` and the iPhone's `apple-mobile-web-app-title` at the
    phone's language at start-up, so the app installs under the name in that language. An app already
    installed keeps its name.
11. **README** gets an English section (setup and play) after the Hebrew.

**Stored data.** Adds optional `lastEvent.key` (string) and `lastEvent.p` (object). Fallback: show
`lastEvent.t`. Document in `docs/ARCHITECTURE.md`. The language choice itself is per phone, not stored
in the table.

**Effects and sound.** Floating texts come from the catalog. Narration follows the language (step 9);
the background and effects have no words and don't change.

**Risks.** Missed strings (the CI check covers Hebrew left in code; review English screens by eye).
Physical CSS that should stay physical (the table geometry) must not be converted: convert rule by
rule, not with search-and-replace. Arc text on the felt uses SVG `textPath`; check it reads correctly in
both directions.

**Tests.**
- [ ] Two-phone test with phone A in Hebrew and phone B in English: each shows the event line, toasts
      and floating texts in its own language; both see the same chips
- [ ] Screenshots of every screen in both languages, portrait, landscape and small phone
- [ ] Catalog check: same keys in both files, no unused keys, no Hebrew outside `he.ts`
- [ ] A phone on the old version at the same table still shows a Hebrew event line
- [ ] `node tests/audio.js` measures the English narration at the same level as the Hebrew; the owner
      has listened to the preview

**Docs to update.** `CLAUDE.md` (rule 7 becomes "copy in both catalogs"; new rule: no text in code;
rule 6: narration in both languages), `sounds/CREDITS.md` (the English lines and voice),
`docs/ARCHITECTURE.md` (i18n, new `lastEvent` fields), `README.md`, `CHANGELOG.md`.

**Done when.** Every word in the app follows the phone's chosen language, and mixed-language tables work.

### R-007 Hold'em table on par with Blackjack

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P1 |
| Size | L |
| Games | Hold'em |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** Blackjack has a real table: a felt oval with seats around the rail, a betting circle
and an exact chip stack per seat, the dealer figure, chips that fly for every action, landscape layout
and a mid-round dealer tool. Hold'em is a list of player rows under a small board with a pot number.
Give Hold'em the same treatment. (Absorbs R-002, the turn indicator.)

**Plan.**
1. **Table view** (`HoldemTable`): a felt oval like Blackjack's, reusing `GEO`/`seatLayout`, extended to
   10 seats. Each seat: avatar, name, stack, and in front of it the chips bet on this street (exact
   stack from `lastAction.chips`, falling back to `chipsOf`). The centre holds the five board slots
   (empty in chips mode, cards in R-012) and the pot as a chip stack with its number; side pots shown as
   separate smaller stacks with their amount.
2. **Markers.** Dealer button puck in front of the button seat (slides to the next seat at a new hand),
   SB/BB tags preflop, folded seats dimmed, an ALL-IN badge, "sitting out" and "waiting for next hand".
3. **Whose turn (from R-002).** Derive the player to act from stored data (seat order, `buttonPid`,
   `bbPid`, `streetBet`, `folded`, `allIn`, the street's highest bet): preflop starts after the big blind,
   later streets after the button. Glow on that seat on every phone; "Your turn" in that player's dock
   with a soft cue. A hint only in chips mode: it never blocks anyone. When the street's betting is
   complete, the dealer gets a hint to deal the next street.
4. **Dock.** Keep the chip tray. Add quick amounts: call, min raise, ½ pot, pot, all-in. Show "to call:
   X" and the minimum raise.
5. **Dealer tools.** Award by tapping the winning seats on the table; if everyone but one folded, a
   one-tap "pot to X"; split pots by selecting several winners (existing `computeAward`).
6. **Landscape** side panel and small-phone layout, as Blackjack has.
7. **Animations** (`fxHold` + `fxRoom`): blinds fly from seats to their bet spot (not straight to the
   pot); each bet/call/raise flies to the seat's bet spot with a floating label ("Raise 200"); when the
   dealer moves to the next street, every bet spot sweeps into the pot; award: the pot (and each side
   pot) flies to its winner(s), split pots divide in the air; fold: a soft fold sound and the seat dims;
   new hand: the button puck slides.
8. **Ceremony and end of game** already work for both games; check them with the new table.

**Stored data.** None. Everything is derived from existing fields.

**Effects and sound.** Player writes already set `lastAction` and `ts`. New handler for the street
change in `fxRoom` (diff of `streetId`), using `FX.ov` to keep bet stacks visible until the sweep lands.

**Risks.** The street sweep is triggered by the room document while the bets live on player documents:
the two snapshots can arrive in either order. Hold the old bet stacks via `FX.ov` until both have
arrived (test with the relay delayed in the harness). Ten seats on a small phone: check sizes.

**Tests.**
- [ ] Hold'em test (R-003) extended: turn indicator on every phone through one hand, street sweep, side
      pots shown and paid
- [ ] Screenshots: 2, 6 and 10 players; portrait, landscape, small phone; mid-street and at award

**Docs to update.** `docs/ARCHITECTURE.md` (Hold'em view, `data-k` keys for bet spots and side pots),
`README.md` (play section), `CHANGELOG.md`, `lessons-learned.md` if the snapshot order bites.

**Done when.** A Hold'em hand looks and feels like a Blackjack round: a table, chips on the felt, and
an animation for every move.

### R-016 Tapping on the table

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P2 |
| Size | M |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** At a real table, players drum on the felt when something exciting happens. Show it:
hands tapping on the table, with the sound, on every phone.
- **Chips mode:** a tap button in each player's dock. Pressing it makes *your* hand tap on the table at
  your seat, on every phone. If several players press at once, several hands drum together.
- **Card mode:** the table taps by itself when a first card is an ace (Q11: in Blackjack any player's
  first card; in Hold'em the first card of the flop), and the button is there too (Q12).

**Plan.**
1. **Hands art**: an original SVG of a hand (a loose fist knocking, and a flat palm slapping), drawn in the
   app's style, sized by the table unit `--u`, in a neutral tone. Two or three variants so a crowd doesn't
   look copied.
2. **Animation** on the `#fx` layer (outside `#app`, rule 3), WAAPI: the hand slides in from the rail at
   the seat, taps three or four times (down fast, up slower, slight random timing and angle), the chips
   on the felt near it jump 1–2 px on each hit, then the hand slides back. About 1.5 s. Several hands at
   once start a few tens of milliseconds apart. `prefers-reduced-motion`: a small shake of the seat only.
3. **Sound**: a wooden-table knock is an effect, so synthesized first (the existing `SND.knock` used for
   check, made fuller and varied per hit). If it doesn't sound like hands on a table, one ElevenLabs sound
   effect or a CC0 recording, previewed by the owner, credited in `sounds/CREDITS.md`. Kept under the chip
   sounds; measured with `node tests/audio.js`.
4. **Button**: a hand icon in the dock (both games), with a short label ("Tap" / "דפיקה"), in the catalog
   from R-006. One press = one tapping burst. Limited to one burst every 2 seconds per player (the button
   dims meanwhile), so it can't flood the table or the free quota.
5. **Syncing the button**: pressing writes `tap: <time>` to the player's own document. Every phone sees the
   new value in the snapshot diff and plays the hand at that player's seat. It deliberately does **not**
   use `lastAction`: that field also feeds the "raised 200" text under a seat and the chip animations,
   and a tap must not replace it. Phones on an older version ignore `tap`.
6. **Card mode trigger**: the diff that turns new cards into deal animations (R-013) raises a `TableTap`
   event when a first card is an ace; every other seated player's hand taps (not the lucky player's). No
   write needed: every phone sees the same cards.
7. **Seat positions**: Blackjack seats exist now; Hold'em gets seats in R-007, so this comes after it.
   A player not seated at the table (the dealer who only deals) taps from the dealer's side.

**Stored data.** Optional player `tap` (number, time of the last press). Fallback: missing = never tapped.
Document in `docs/ARCHITECTURE.md`.

**Effects and sound.** New `tap` handler next to `fxBJ` / `fxHold` (diff on `tap`, not `lastAction`);
the card-mode trigger lives in the card diff (R-013).

**Risks.** A slow phone that receives many taps at once: cap at 4 hands on screen, skip the rest. A phone
that opens the table later must not replay old taps: only taps newer than the moment it joined play.

**Tests.**
- [ ] Two-phone test: phone A presses the button; phone B plays one tap at A's seat; pressing again within
      2 seconds does nothing
- [ ] A reloaded phone doesn't replay old taps
- [ ] Screenshots mid-tap, portrait and landscape; `node tests/audio.js` for the knock
- [ ] Card mode (with R-011/R-012): a dealt first ace makes the other seats tap on every phone

**Docs to update.** `docs/ARCHITECTURE.md`, `README.md` (play), `CHANGELOG.md`.

**Done when.** A press of the button, or an ace in the card mode, makes hands drum on the table on every
phone.

### R-010 Card mode core: the app deals

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P1 |
| Size | L |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** A second way to play: when opening a table the host chooses **with cards** or
**without cards** (today's mode). With cards, the app shuffles, deals, shows each player their own cards,
enforces turns, decides results and pays. This entry is the shared engine; R-011 and R-012 are the two
games on top of it.

**Decisions (Q1, Q3).** Players may be in the same room or in different places. The deck lives in a small
dealer service on Vercel (free), so no phone knows a card before it is dealt. The host's phone runs the
turn order. Each player's private cards are encrypted so only that player's phone can read them.

**Where the deck lives.** Hidden cards need somewhere to keep the deck that no player can look into, and
that place has to run code (shuffle, decide what may be shown). Firebase's free plan stores and syncs
data but runs no code: its security rules can only allow or refuse a read or write; they can't shuffle or
keep a secret. Firebase's code (Cloud Functions) needs the paid Blaze plan. The other options:

| | Verdict |
|---|---|
| **Vercel** (free Hobby plan) | **Chosen.** Free serverless functions, far more than a game night uses (about 1,500–3,000 calls). Separate from the Netlify site: if a limit were ever hit, Vercel pauses only the dealer, so chips tables keep working. Already connected here |
| Netlify Functions | Same account as the site. On Netlify's free plan, functions draw on the same monthly credits that keep the site online; running out pauses the whole site until next month |
| Supabase Edge Functions | Free, but a free Supabase project is paused after a week without database activity: with weekly game nights it could be asleep when the table opens |
| Firebase Blaze | Works well and would stay inside the free allowance, but needs a credit card and has no hard spending cap |

**The dealer service** (`dealer/`, a separate Vercel project from the same repository):
- **Holds no data.** Each deck is derived from a secret kept in Vercel's settings: the shuffle for a hand is
  driven by HMAC-SHA256(secret, table code + hand or shoe number + a random salt the host writes when the
  hand starts). Same inputs, same deck, so nothing is stored on the server and any call can recompute it.
- **Reads the table, never trusts the caller.** For every call it reads the room and player documents from
  Firestore over its public REST interface (the rules already allow reading) and only reveals what the
  game state says is due: the flop once the table is on the flop, the next Blackjack card when a hit is
  pending, the dealer's hole card when the dealer plays, a face-down double when the hand is settled,
  showdown cards at showdown.
- **Private cards are encrypted to their owner.** Every phone publishes a public key on its player
  document; the service encrypts that player's hole cards to the key *it reads from Firestore* (not one
  sent in the call), so anyone may ask, but only that phone can read the answer.
- **Proves it played fair.** At the start of each hand it gives a hash of the deck order; after the hand
  it reveals the order and salt, and every phone checks the hash.
- **The honest limit.** The table documents are writable by anyone with the app (today's rules). Someone
  who forged the table state to reveal a card early would make the table jump on every phone, so it can't
  be done quietly. The owner, who holds the secret, could compute decks.

**Why "both places" matters.** In the same room, people see each other and talk, so hidden cards only need
to stop a glance at the database, and voice chat adds little. With remote players, the app is the only
table: everything a player would see across a real table (who's thinking, cards shown at showdown,
chips moving) must be on screen, the game must not stall when one phone sleeps, and they need a way to
talk (R-014, R-015). The plans assume remote players.

**How it works.**
- **The host phone runs the game.** It asks the dealer service for cards, applies every action and
  writes the results. It never sees a card before everyone else does. Players never change shared game state directly: they write a request to their own
  player document (`req: {id, k, amt}`); the host validates it against the rules (turn, amount, legal
  move), applies it, and acknowledges (`ack: id`). One writer for game state means no write races (the
  R-004 class of bug can't happen in this mode).
- **Shuffle** (in the service): Fisher–Yates driven by the HMAC stream, with rejection sampling (no
  modulo bias).
- **Hidden cards**: every phone creates a key pair (WebCrypto ECDH P-256) once and publishes the public
  key on its player document (`pub`); the private key never leaves the phone. The service encrypts each
  player's private cards with AES-GCM using a key derived from the service's own key pair and the
  player's public key; the host writes the ciphertext to that player's document (`cardsEnc`). Public
  cards (the board, Blackjack player cards, cards shown at showdown) are written in plain text.
- **Host handover**: the host holds no secret, so handing over is just `mkhost`. If the host phone
  disappears mid-hand (closed, out of battery), after 20 seconds of silence any player can take over and
  **the hand carries on** from the stored state. Hosting keeps the screen on (Screen Wake Lock).
- **Single-device mode** (no Firebase config): no service; the phone shuffles locally, and hidden cards
  need a "pass the phone" curtain: "Pass to Dana – tap to see your cards".
- **If the service can't be reached** (no network, Vercel down): the table shows "The dealer isn't
  answering" and retries; nothing is dealt and no chips move until it answers.

**Plan.**
1. **Create screen**: a "With cards / Without cards" choice under the game choice, with one line
   explaining each. Card tables get their rule settings (R-011, R-012).
2. **Domain** (`domain/cards/`): card type, deck/shoe, shuffle from a byte stream, commit/verify; pure,
   unit tested, and shared by the app (single-device mode) and the service.
3. **Dealer service** (`dealer/api/cards.ts`, TypeScript, Vercel): one endpoint, `POST {room, hand,
   want: 'commit' | 'hole' | 'board' | 'next' | 'dealer' | 'reveal', pid?}`. Reads Firestore over REST,
   checks the request against the stored game state, answers. Only the Netlify site's origin is allowed
   (CORS); simple per-table rate limit. Secrets in Vercel settings: `DEALER_SECRET`, the service's private
   key, `FIREBASE_PROJECT_ID`. Unit tests for every "is this card due?" rule.
4. **Vercel set-up, done by Claude** through the connected Vercel and Netlify tools (the owner approves
   each step): create the Vercel project linked to this repository with root folder `dealer/`, generate a
   random `DEALER_SECRET` and the service's key pair and store them as sensitive Vercel variables, then add
   the service's address to Netlify as `DEALER_URL` (written into `config.js` by
   `scripts/build-config.js`). The Vercel tools show no team on the owner's account yet, so the owner may
   first need to finish signing in to Vercel and allow it to read the GitHub repository (a one-time
   approval only the owner can give). `README.md` records the set-up so it can be redone.
5. **Crypto** (`data/crypto.ts`): key pair create/store (IndexedDB, non-extractable private key), derive,
   encrypt, decrypt; unit tested in Node (WebCrypto is available there).
6. **Request protocol** (`sync/requests.ts`): players send requests, the host engine consumes them in
   order of arrival, applies the pure game function, writes results, acknowledges. Duplicate request ids
   are ignored. The player's UI shows the action as pending until acknowledged (with a spinner after
   1 s and an error after 10 s).
7. **Host engine loop**: runs only on the host phone; asks the service for cards; timers for turn timeouts (if on) and automatic
   steps (dealer plays in Blackjack, next street in Hold'em).
8. **Waiting-for-host banner** and take-over flow (the hand continues).
9. **Reuse chip state**: card tables keep `stack`, `hands[]`, `committed`, `streetBet` with the same
   meaning, so chip animations, the ceremony, statistics and the end of game work unchanged.
10. **Quota check**: count writes, reads and service calls per hand in the harness; target under 120 reads per hand per
    player. If over, batch the host's writes for one action into one write where possible.
11. **CLAUDE.md rule 5** becomes: "Chips mode: chips only, no card visuals or sounds. Card mode: cards are
   drawn and animated by the app."

**Stored data.** Room: `mode: 'cards'`, `appMin` (R-009), `rules` (map), `salt` (per hand or shoe),
`commit`, `reveal`, `g` (game state: whose turn, what's public on the table), legacy `phase`/`stage` set
to `'cards'` (R-009). Player: `pub`, `cardsEnc`, `req`, `ack`, `shown` (cards turned up). All optional;
chips tables never have them. Document each in `docs/ARCHITECTURE.md`.

**Effects and sound.** Card animations are R-013. Chip animations reuse the existing handlers since the
chip fields keep their meaning.

**Risks.**
- The host phone goes to sleep (iPhones stop JavaScript in the background): the game pauses. Wake Lock,
  a clear banner, and take-over (the hand continues) are the mitigation; tell players in the README.
- Latency: every action is a round trip through the host, and dealing adds a call to the service
  (typically 200–600 ms, up to ~1 s when the service has been idle). Show the action at once as pending
  on the player's phone; the deal animation covers the wait.
- Vercel's free plan pauses a project that goes over its free usage (until the next month). A night uses
  a small fraction; the tests count calls per hand to keep it that way.
- Crypto mistakes: use only WebCrypto primitives, a fresh random IV per message, no home-made ciphers.
- Quota (see constraints).

**Tests.**
- [ ] Unit: shuffle distribution (chi-square over many shuffles), commit/verify, encrypt/decrypt between
      two key pairs, a third key can't decrypt
- [ ] Harness: three phones; a player's phone shows its own cards, the others' phones hold only ciphertext
- [ ] Harness: host disappears mid-hand → take-over → the hand continues with the same cards
- [ ] Service: refuses to reveal the flop before the table is on the flop, a hit card when no hit is
      pending, a face-down double before settlement; the same inputs always give the same deck
- [ ] Harness with the service unreachable: no cards, no chips moved, a clear message
- [ ] Harness: duplicate and out-of-turn requests are refused without changing state

**Docs to update.** `CLAUDE.md` (rule 5, a rule on the host-only writer for card tables),
`docs/ARCHITECTURE.md` (card mode section, request protocol, new fields), `README.md` (choosing a mode,
keeping the host phone awake, what "hidden" means, Vercel set-up), `CHANGELOG.md`.

**Done when.** A card table can be opened, players join, and the engine deals, takes requests and hands
over safely; the two games (R-011, R-012) plug into it.

### R-011 Blackjack with cards

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P1 |
| Size | L |
| Games | Blackjack |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** The whole Blackjack round inside the app: bets, the deal, hit/stand/double/split/
surrender/insurance, the dealer's play, results and payouts, with no one marking results by hand.

**Decisions (Q7, Q9, double down).** The host sets every house rule when opening the table: number of decks
(1–8, default 6), reshuffle point (default 75%), dealer stands or hits on soft 17 (default stands),
dealer peeks for blackjack (default yes), blackjack pays 3:2 or 6:5 (default 3:2), double after split
(default yes), surrender (default late), insurance (default on), most hands per player (2–4, default 4),
split aces get one card (default yes). Players' cards are always face up. When doubling, the player
chooses whether the extra card is dealt face up or face down.

**Plan.**
1. **Rules engine** (`domain/blackjack/cards.ts`): hand totals (soft/hard), blackjack detection, legal
   moves per hand, dealer play (stand or hit on soft 17), peek, result per hand, payouts (reusing the
   existing payout table and the `paid` flag). Pure; exhaustive unit tests.
2. **Round flow** (host engine): betting (as today; the host or a timer closes betting) → deal two cards
   to each hand and two to the dealer (one face down) → insurance offer if the dealer shows an ace →
   peek → players act in seat order, one hand at a time → the dealer reveals and draws → results and
   payout → cards collected → next round. Reshuffle when the cut card comes out.
3. **Player moves**: buttons for the legal moves only (Hit, Stand, Double, Split, Surrender, Insurance),
   sent as requests. Automatic stand on 21. Optional turn timer → stand.
4. **Double down face up or face down.** Pressing Double opens a two-button choice, "Face up" / "Face
   down", with "Remember my choice" (saved on the phone; changeable in Settings). Face up: the card is
   dealt open as usual. Face down: the card is dealt sideways and closed, the hand's total shows as
   "?", and the card stays with the dealer service until the dealer has played; then it is turned over and
   the hand is settled. Nobody sees it before then, the player included (decided). A face-down card can't make the player bust before the dealer plays, so the dealer always plays out.
5. **Showing cards**: each hand's cards on the felt in front of its betting circle, the total next to
   them ("soft 17"); the dealer's cards at the top. Bust, blackjack and 21 badges.
6. **Host panel** shrinks to: start/close betting, pause, rules, players. The settle sheet is not used.
7. **Statistics** come later (R-008, step 12): keep each hand's final cards and totals in the stored
   state so R-008 can count busts, 21s and dealer busts without changing this game.

**Stored data.** `hands[i].cards` (public card codes such as `"AS"`, `"TD"`), room `g.dealer` (public
dealer cards); the dealer's hole card stays with the service until the dealer plays. Face-down double: `hands[i].down: true`
and a `"??"` placeholder in `cards` until it is turned over (the service reveals it only at settlement). Existing `bet`, `doubled`, `split`, `result`, `paid` keep their meaning.

**Effects and sound.** R-013 (deal, hit, face-down double, flip, collect); the chip payouts reuse
`bjres`.

**Risks.** Split edge cases (split aces, re-splits, 21 after split is not blackjack): unit tests first.
A player leaving mid-round: their hands stand automatically.

**Tests.**
- [ ] Unit: every rule above, including dealer soft 17 both ways, insurance with and without a dealer
      blackjack, each host rule switched on and off, and a face-down double that would have won and lost
- [ ] Harness: a full scripted round with a fixed shuffle (test hook), three phones; payouts and house
      balance exact on all phones
- [ ] Screenshots: 1, 4 and 7 players with splits, portrait and landscape

**Docs to update.** `docs/ARCHITECTURE.md` (card Blackjack flow), `README.md`, `CHANGELOG.md`.

**Done when.** A full evening of card-mode Blackjack runs without the host marking a single result.

### R-013 Card animations and sounds

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P1 |
| Size | L |
| Games | Both (card mode only) |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** In the card mode every card moves like a real one: dealt from the shoe to each player,
flipped, gathered back. For Hold'em, the burn and the flop, turn and river; for Blackjack, hits, the
dealer's hole card, splits.

**Plan.**
1. **Card art**: an original SVG design: a face with large rank and suit in the corners (readable on a
   small phone), simple court-card artwork, and a card back matching the app's felt and chips. One
   `CardView` component, sized by the table unit `--u`.
2. **Card layer**: flying cards live on the `#fx` layer outside the table, like chips; positions come
   from `data-k` keys: `shoe`, `discard`, `muck`, `card:<pid>:<hand>:<i>`, `board:<i>`, `dcard:<i>`.
3. **Motions** (WAAPI, transform and opacity only):
   - *Deal*: from the shoe along a slight arc to the seat, small random rotation, landing face down
     (Hold'em) or flipping on landing (Blackjack player cards); two passes round the table in order,
     ~120 ms apart.
   - *Your own hole cards*: land in front of your seat, then slide into your dock.
   - *Burn*: one card slides from the shoe to the discard pile face down.
   - *Flop*: three cards slide to the centre stacked, spread into place, then flip one after another;
     *turn* and *river*: one card slides and flips.
   - *Flip*: a 3D turn (rotateY with the two faces back to back).
   - *Showdown*: the remaining players' cards flip in showdown order; the winning five cards lift
     slightly and glow, the rest dim.
   - *Fold / muck*: the cards slide face down to the muck in the centre.
   - *Blackjack*: player cards always land face up; hit cards fly to the hand and fan; the dealer's hole
     card flips when the dealer plays; split: the second card slides to the new betting circle and each
     gets a new card; round end: all cards sweep to the discard tray.
   - *Double down*: the doubling chips fly next to the bet (as today), then one card arrives sideways
     across the hand: face up, or **face down** if the player chose it. A face-down card flips over
     after the dealer has played, just before that hand is paid.
   - *Your Hold'em cards*: press-and-hold lifts and flips them in your dock; "Show my cards" flips them
     and leaves them up.
   - *Shuffle*: when the shoe is reshuffled, a short riffle at the shoe.
   - *Aces*: a first card that is an ace raises the table-tap event from R-016.
4. **Sounds** (rule 6): card slide (short filtered noise swish), flip (soft snap) and riffle shuffle are
   effects, so synthesized first. If they sound fake, use a CC0 recording or one ElevenLabs sound effect
   (one take, owner previews first), credited in `sounds/CREDITS.md`. Measured with `tests/audio.js`
   and kept below the chip sounds.
5. **New narration lines**, recorded in Hebrew and English together (R-006), same voice as the existing
   lines, owner previews first: "Dealer has {n}" is too many files, so short fixed lines only:
   "Dealer busts", "Dealer has blackjack", "Insurance?", "Shuffling", "Showdown", "Split pot". Triggered
   from the change→animation code like the existing ones.
6. **Driven by state** (rule 4): new cards in the state → the matching animation. A phone that joins
   mid-hand shows the table as it is, without replaying history.
7. **Reduced motion**: respect `prefers-reduced-motion` (fades instead of flights).

**Stored data.** None beyond R-011 / R-012.

**Effects and sound.** This entry is the effects; new diff handlers turn card changes into events
(`CardsDealt`, `BoardDealt`, `CardsShown`, `CardsCollected`).

**Risks.** Performance on older phones with 10 players × 2 cards in flight: cap simultaneous flights,
reuse elements, test on a low-end Android. The deal must finish before the first player's turn shows.

**Tests.**
- [ ] Harness: event sequence for a scripted hand fires each animation once on every phone
- [ ] A recorded screen video of a hand (Playwright video) to review timing
- [ ] `node tests/audio.js` for the new sounds

**Docs to update.** `docs/ARCHITECTURE.md` (card effects, `data-k` keys), `CHANGELOG.md`.

**Done when.** Every card on the table arrives, flips and leaves with a motion and a sound.

### R-012 Hold'em with cards

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P1 |
| Size | L |
| Games | Hold'em |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** The whole Hold'em hand inside the app: blinds, hole cards, enforced turns, the flop,
turn and river, showdown with automatic winners, side pots and payouts.

**Plan.**
1. **Hand evaluator** (`domain/holdem/evaluate.ts`): best five of seven, returns rank (high card…royal
   flush), the five cards, and a comparable score; ties split. Unit tested against a table of known hands
   and every tie-break rule.
2. **Hand flow** (host engine): new hand → button moves, blinds posted → two hole cards each (encrypted)
   → betting rounds with enforced turn order (from R-007's turn logic, now enforced) → burn and deal
   flop (3), turn, river → showdown. If everyone but one folds, that player wins without showing.
   If all remaining players are all-in, the remaining board is dealt with no more betting.
3. **Actions** as requests: fold, check, call, bet/raise (min raise enforced), all-in. Turn timer
   (decision Q8): off by default; the host can set 30 or 60 seconds. When it runs out: check if
   possible, otherwise fold. The last 10 seconds show as a ring round the seat on every phone.
4. **Showdown**: the last aggressor shows first, then clockwise; losing hands may be mucked (setting:
   auto-muck losers). Winners per pot level from the evaluator, then today's `computeAward` side-pot
   logic pays each pot; odd chips to the first winner after the button.
5. **Your cards** (decision Q9): in your dock, large, **face down**. Press and hold to look; a "Show my
   cards" button keeps them face up until pressed again (remembered on the phone). Whether face up or
   down, the hand you currently hold is shown under them only while they're visible ("Pair of kings").
6. **Host panel**: start the next hand (or automatic after N seconds), pause, rules (blinds, timer,
   blind increase schedule optional later).
7. **Statistics** come later (R-008, step 12): keep each showdown's hand ranks in the stored state so
   R-008 can count showdowns, best hand and wins by rank without changing this game.

**Stored data.** Room `g.board` (public cards), `g.toAct`, `g.minRaise`; player `cardsEnc` (hole cards),
`shown` (cards turned up at showdown). Existing Hold'em fields keep their meaning.

**Effects and sound.** R-013 (deal, flop/turn/river, showdown flip, muck, collect).

**Risks.** Side pots with several all-ins and split winners: unit tests built from real hand histories.
Players acting before their request is acknowledged: the dock shows "waiting for your turn" and sends
nothing.

**Tests.**
- [ ] Unit: evaluator (all ranks, kickers, board plays, wheel straight), side pots with 3 all-ins and a split
- [ ] Harness: scripted hands with a fixed shuffle, three phones: fold-out win, showdown, split pot, all-in
      run-out
- [ ] Screenshots: 2, 6, 10 players, showdown, portrait and landscape

**Docs to update.** `docs/ARCHITECTURE.md`, `README.md`, `CHANGELOG.md`.

**Done when.** A full Hold'em evening runs with the app as dealer and every pot paid automatically.

### R-008 Table statistics

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P2 |
| Size | L |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** A statistics board for the table: per player and for the whole table, with numbers
that fit the game and the mode (the chips mode doesn't know cards, so it can't count busts).

**Decision (Q6).** Per table only.

**What is counted.**

| | Chips mode | Card mode adds |
|---|---|---|
| Blackjack, per player | rounds played, hands (incl. splits), wins, losses, pushes, blackjacks, doubles (won), splits, surrenders, insurance taken / won, biggest win, biggest bet, net, best winning streak | busts, 21s, dealer busts while playing, average hand total, wins by dealer bust |
| Blackjack, table | rounds, house balance over time, most blackjacks, biggest single payout | dealer bust rate, shoes played |
| Hold'em, per player | hands dealt in, hands won, pots won, biggest pot, net, folds by street, VPIP (put chips in voluntarily preflop), PFR (raised preflop), all-ins and all-ins won | showdowns reached / won, best hand made, wins by hand rank |
| Hold'em, table | hands played, biggest pot, average pot, chip leader over time | most common winning hand |

**Plan.**
1. **Spec per game and mode** (`domain/stats/`): a list of metrics, each with its key, label key, how it
   is formatted, and whether it's per player or per table. The board renders from the spec (strategy per
   `GameMode`), so card-mode metrics appear only on card tables.
2. **Counting.** Counters live in an optional `stats` map on each player document and on the room, and
   always change by increment (no lost updates). Each phone counts its **own** actions in the same write
   as the action (`stats.doubles: +1` in the double write). The host counts **outcomes** in the payout
   writes (wins, losses, blackjacks, pots won, biggest pot). Pure functions compute the increments from
   the before/after state, so they're unit tested.
3. **History for a chart.** Room `hist`: up to 100 points of `[round, {pid: stack}]`, written by the
   host at each payout; when full, every second point is dropped, so the chart always spans the whole
   game at lower detail. About 8 KB.
4. **Board.** A Statistics sheet (button in the room header) with three tabs: Table, Players (sortable
   table), Me (your own numbers at this table). Leaders get a small badge ("most blackjacks"). A stack-over-time line chart (inline SVG,
   one line per player, tap to highlight).
5. **End of game.** The ceremony and the final card show 3–4 awards (biggest pot, most blackjacks, best
   streak). Closed tables keep their statistics.
6. **Host controls.** Reset statistics (writes `statsFrom` = current round and clears the counters).

**Stored data.** Optional `stats` (map of counters) on players and room; optional room `hist` (array) and
`statsFrom` (round or hand number). Fallbacks: missing `stats` shows "—"; missing `statsFrom` means "since
statistics were added"; the board says "since round N". A phone on an older version won't count its own
actions; until it self-updates, those numbers are marked incomplete for that player (`stats.v` missing).

**Effects and sound.** None, apart from the end-of-game awards in the ceremony.

**Risks.** Double counting when money moves in more than one place (lessons-learned "mark money that has
already moved"): a mid-round blackjack is counted in `bjNow`, and the payout must skip `paid` hands for
statistics too. Write size: the counters add a few hundred bytes per player document.

**Tests.**
- [ ] Unit tests: stats increments for every action and outcome, both games, both modes
- [ ] Two-phone test: after a scripted round both phones show the same numbers; a mid-round blackjack is
      counted once
- [ ] Screenshots of the board in both languages

**Docs to update.** `docs/ARCHITECTURE.md` (new fields), `README.md`, `CHANGELOG.md`.

**Done when.** At any point, and at the end of the game, every phone shows the same statistics, and they
match a hand-counted session.

### R-014 Voice messages

| | |
|---|---|
| Type | Feature |
| Status | Planned |
| Priority | P2 |
| Size | L |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** Players send each other short voice messages at the table (decision Q5: messages now,
live voice later as R-015). Useful most for players in different places (Q1).

**How it works.** Hold the microphone button, speak (up to 15 seconds), release; every phone at the table
plays it with the speaker's seat glowing. Works on any network, needs no new service, and stays inside
the free plan.

**Plan.**
1. **Record** with `MediaRecorder`: Opus in WebM where supported (Chrome, Android), AAC in MP4 on
   iPhones; mono, ~16 kbit/s, so 15 seconds ≈ 30 KB.
2. **Send**: write to the sender's own player document as `vmsg: {id, mime, data (base64), dur, at}`.
   The sender clears it after 30 seconds, so later updates to that document stay small.
3. **Play** on the other phones: queued, one at a time, only messages newer than when that phone joined;
   the ambience ducks while it plays; the speaker's seat glows. Respects the sound switch; a separate
   "voice messages" switch in Settings.
4. **Format check**: if a phone can't play the other format (older iPhones with WebM), show "can't play
   on this phone" instead of failing silently. Test on a real iPhone and Android early.
5. **Permissions**: microphone is asked on the first press, with a one-line explanation; a refusal
   hides the button.

**Stored data.** Optional player `vmsg` (`{id, mime, data, dur, at}`). Fallback: missing means no
message. Old phones ignore it.

**Effects and sound.** The background and narration duck while a message plays (the same 6 dB ducking
the narration uses); the speaker's seat glows. A message never interrupts the narration: it waits. No
`lastAction` (voice doesn't move chips).

**Risks.** iPhones change the audio route when the microphone is on (sound may move to the earpiece and
the other sounds get quieter): test recording on a real iPhone first, before building the UI. The clip
travels with the player document until cleared after 30 seconds; measure the extra traffic. Privacy: say
in the README that messages pass through the table's database and are deleted after 30 seconds.

**Tests.**
- [ ] Unit: message queue (order, skipping old messages, waiting for narration)
- [ ] Harness: phone A sends a generated audio clip (Playwright fake microphone), phone B receives and
      plays it once
- [ ] By hand: iPhone → Android and Android → iPhone

**Docs to update.** `docs/ARCHITECTURE.md`, `README.md` (voice messages and privacy), `CHANGELOG.md`.

**Done when.** A held button sends a message that every phone at the table hears once.

### R-015 Live voice chat

| | |
|---|---|
| Type | Feature |
| Status | Proposed |
| Priority | P2 |
| Size | L |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** Players in different places talk live, as if at one table (decision Q5: after R-014).

**How it works.** Real-time audio between phones (WebRTC), push-to-talk by default with an open-mic switch.
Phones connect directly to each other (fine up to about 8 players); the table's documents carry the
connection set-up, so no new Firestore collection is needed. Some mobile networks block direct
connections; those need a relay (TURN) server. Cloudflare's is free at this scale but needs an account,
plus a tiny Netlify Function that hands out short-lived passwords (one call per player per table, far too
few to matter for the Netlify credits that R-010 worries about). A hosted voice service (LiveKit, Daily)
is the alternative: less code, another account and key. Decide between them when this entry is planned
in full.

**Plan.**
1. **Connections**: one `RTCPeerConnection` per other player, set up with the "perfect negotiation"
   pattern; offers, answers and network candidates go in the sender's own player document
   (`rtc: {[peerPid]: {sdp, ice[]}}`), which every phone already listens to.
2. **Audio**: Opus with echo cancellation, noise suppression and auto gain on; push-to-talk mutes the
   microphone track when the button is up; open mic keeps it on.
3. **Relay**: STUN (public) for most networks; TURN via a Netlify Function that returns short-lived
   credentials (secret kept in Netlify env vars).
4. **UI**: microphone button in the dock (hold to talk / switch to open mic); a speaking ring on seats
   (measured locally from each incoming stream); per-player mute in the Players sheet.
5. **Lifecycle**: join voice on entering the table (only after a tap, for permissions), leave on going
   home or when the screen locks; reconnect on network change.

**Stored data.** Optional player `rtc` (connection set-up) and `voice` (on/off, for the seat icon).
Fallback: missing means that player isn't in voice. Old phones ignore them.

**Effects and sound.** Background and narration duck while someone talks; a speaking ring on the seat.

**Risks.** The same iPhone audio-route problem as R-014, more so with an open microphone; browsers stop the
microphone in the background; echo when two players sit in the same room (push-to-talk default helps).

**Tests.**
- [ ] Two browser contexts with fake media connect and exchange audio
- [ ] By hand on two real phones on different networks (Wi-Fi and cellular)

**Docs to update.** `docs/ARCHITECTURE.md`, `README.md`, `CHANGELOG.md`.

**Done when.** Players in different places talk live during a game.

### R-017 Lock down who can change the table

| | |
|---|---|
| Type | Fix |
| Status | Proposed |
| Priority | P2 (P1 before the card mode, if wanted) |
| Size | M |
| Games | Both |
| Branch | — |
| Added | 2026-11-22 |
| Done | — |

**Problem / goal.** Today's Firestore rules let anyone who has the app and a table code write anything
to that table: there is no sign-in, and the rules only check the code's format. The app itself behaves,
but someone with technical knowledge could bypass it from a browser console and, for example, give
themselves chips, change another player's stack, or move a card table to the next street. Any table's code
can also be listed (`allow list: if true`). Fine among friends; worth closing before a card mode that
remote players use.

**Plan (outline; full plan if the owner wants it).**
1. **Anonymous sign-in** with Firebase Auth (free on the Spark plan, no account or password for players):
   each phone gets a stable user id the first time it opens the app.
2. **Player documents** store that id (`uid`); new rules: a player document can only be written by its own
   phone, except by the table's host (who pays out and adds players without phones).
3. **Room document**: only the host's phone writes it (it already does all room writes today).
4. **Card tables**: the dealer service writes the revealed cards with its own credentials, and nobody
   else can change them.
5. **Listing tables**: limit the home screen's list to open tables (`closed != true`) and drop listing of
   every player.
6. **Migration**: the new rules must accept old tables and old app versions until everyone has updated;
   the owner pastes the rules into the Firebase console once (README steps).

**Stored data.** Optional `uid` on players and `hostUid` on rooms. Old phones without them keep working
until the rules are switched over.

**Risks.** Rules changes are the one thing the owner must apply by hand, and a mistake locks every table:
test the rules with the Firebase emulator before pasting. Host handover must move `hostUid`.

**Tests.** Rules unit tests in the emulator (a player can't write another player's stack, a non-host
can't write the room); the two-phone test passes with the new rules.

**Docs to update.** `firestore.rules`, `README.md` (pasting the rules), `docs/ARCHITECTURE.md`,
`CLAUDE.md` (the files table), `CHANGELOG.md`.

**Done when.** Only the right phone can change each part of a table.

---

## Done

Newest first. Short summary, date it reached `main`, commit.

### R-002 Hold'em: show the dealer which player is to act

| | |
|---|---|
| Type | Feature |
| Status | Dropped |
| Priority | P2 |
| Size | M |
| Games | Hold'em |
| Branch | — |
| Added | 2026-11-21 |
| Done | 2026-11-22: merged into R-007 |

Merged into [R-007](#r-007-holdem-table-on-par-with-blackjack) (Hold'em on par with Blackjack), step 3.

