# Testing

The browser tests drive the built app (`dist/`) in headless Chromium with Playwright. Each script builds the
app once (`npx vite build`; `SKIP_BUILD=1` reuses the `dist/` that is there) and starts its own static server on
`dist/`, so nothing else needs to be running. The unit tests run in Node with Vitest.

Setup once:

```
npm install
npm i -g playwright
npx playwright install chromium
```

Checks without a browser: `npm run lint` (ESLint, including the purity rules for `src/domain/` and `src/sync/`),
`npm run typecheck` (TypeScript, strict: the app, the build tooling, and `src/domain/` alone without DOM types),
`npm test` (Vitest: `src/**/*.test.ts`, `scripts/**/*.test.mts`: the game rules in `src/domain/`, the data layer in
`src/data/`, the document diff and event bus in `src/sync/`, and the service worker plugin).

## Unit tests for the game rules

Each file in `src/domain/` has its tests next to it (`chips.test.ts`, `holdem/rules.test.ts`, `holdem/pots.test.ts`,
`blackjack/rules.test.ts`, `blackjack/actions.test.ts`, `blackjack/round.test.ts`). They build documents by hand and
check the patch or refusal a command returns: side pots (two players, three all-ins at different levels, ties, the odd
chip, folded contributors, a single contributor's excess), button and blinds (heads-up, 3+, sitting out, empty
stacks), the minimum raise, action classification, Blackjack limits, double/split/insurance/surrender, every payout,
paid hands, `bjPaidRound` and the house balance.

`npm run coverage` runs them with v8 coverage of `src/domain/` (text report). At the end of R-005 phase 2: 100%
statements, lines and functions; branches 100% except three defensive fallbacks in `holdem/rules.ts` that today's data
can't reach (kept so behaviour stays exactly as before). Keep pots and payouts at 100% branches.

A rule change needs a unit test first; the browser tests then prove the app still uses it the same way.

## Unit tests for the data layer

`src/data/` has its tests next to it, and `npm run coverage` covers it too (100%):

- `store.contract.test.ts`, the **store contract**: the same cases run against every adapter, `local-store` (on an
  in-memory storage) and `tests/fakefs.js` behind the Firestore adapter (the fake is loaded into Node as text with
  `?raw` and run with a plain object as `window`, so the browser tests' stand-in is held to the same contract). Reading a
  missing document, `set` (replaces, `data()` is a copy), `update` (named fields only, arrays replaced, a missing
  document rejected), increments (on set and update, missing counts as 0, negative, applied to the stored value rather
  than the writer's copy), `delete`, listeners (never called inside the call or the write, every change, stop when
  unsubscribed), collections (direct documents only), `orderBy` (missing as 0) / `where ==` / `limit`, and query
  listeners. The one place the adapters differ is declared per adapter: `update` of a map merges in `local-store`
  and replaces in Firestore. Add a case here when the app starts using another part of Firestore, and implement it in
  both adapters and in `tests/fakefs.js`.
- `local-store.test.ts`: the `chips.localdb` key and format (a database written by the old `LocalDB` reads back), a
  damaged database, the `{__inc}` marker, the `invalid_argument` refusal, nested merge, the injected `defer`.
- `firestore-store.test.ts`: the adapter starts the SDK with the same settings, passes calls through, passes an error
  callback only when given, uses `FieldValue.increment`. `connect.test.ts`: when the app goes cloud or local.
- `writes.test.ts`: one write at a time per document, documents in parallel, a failure reported once without
  blocking the next write, the guard refusing without touching the store, the store asked for on every write.
- `schema.test.ts`: `normalizeRoom` / `normalizePlayer` on documents shaped like the first release (before every
  *added* field), today's documents (unchanged), nothing at all, damaged values, values and fields from a newer phone,
  and the guard fields (`mode`, `appMin`) read exactly as the guard always read them.

## Unit tests for the events

`src/sync/` has its tests next to it, and `npm run coverage` covers it (100% statements and lines; the branches left are
`|| 0` fallbacks the normalised documents never hit):

- `diff.test.ts`: old/new document pairs for every event (each Blackjack and Hold'em `lastAction.k`, each room change)
  and every case that must stay silent: the same `ts`, no `lastAction`, a phone's first copy (old = empty: joining
  mid-hand replays nothing), a player who left, a table the guard refuses, an unknown action. Also the exact chips
  added to a bet, the split and double spot, the settled spots and totals, the payout read from `roundEnd` or from the
  event text, the lock's spots in seat order, and several room events in their old order.
- `events.test.ts`: before → render → after, event and subscription order, the value handed from `before` to `after`,
  unsubscribing (only that subscription), a subscriber added during an emit, a subscriber that throws.

The effects themselves (`src/fx/`, DOM and Web Animations) are checked in the browser: the two-phone and Hold'em tests
count the flying chips another phone shows for one bet (exactly one; two would mean a doubled subscription, none a lost
event), and the pixel comparison and screenshots wait for them to land.

## The screens

The components in `src/ui/` (R-005 phase 5) are checked in the browser: the pixel comparison (zero pixels on all 56
screens, below) and every browser test click them by their `data-a` attributes; `tests/behaviour.test.js` checks what a
render must keep now that Preact patches the page. When converting something none of the 56 screens shows, add a screen
for it to `tests/visual.js` first and take its baseline from the code *before* the change (`--update --only <name>`),
then convert and require zero differing pixels. Their pure parts have unit tests: `src/ui/avatars.test.ts` (which stored avatars are shown, the letter and its
colour), `src/ui/components/rank.test.ts` (shared places), `src/games/registry.test.ts`,
`src/ui/tables/blackjack/geometry.test.ts` (seats and printed arcs exactly where the string view put them, for 0 to 12
players; symmetry, crowded tables, split hands) and `select.test.ts` (what each seat shows: this round's and last
round's hands, an override while chips fly, the result badge, tapping a seat, your chips in hand, a seat out of the
round; the bettors and chips on the felt, the dock's hands, the dealer's blackjack button).

## The scripts

| Command | What it checks |
|---|---|
| `node tests/race.test.js` | Money conservation (stacks + bets + house) when the dealer's player writes reach the server late and a player bets the moment the next round opens; for a paid and a cancelled round. Uses `hub.delay` in `tests/lib.js` |
| `node tests/two-phones.test.js` | A blackjack table on **two separate phones** that sync: avatars (character and photo), one bet flying exactly once on the other phone and not at all on the bettor's (`watchFlies` in `tests/lib.js`), exact chip stacks seen by the other phone, deal, paying a blackjack mid-round, the payout not paying it twice, house balance, ending the game, the ceremony on the other phone, and a reloaded phone seeing the closed table. Prints PASS/FAIL per check and exits 1 on any failure |
| `node tests/holdem.test.js` | Texas Hold'em on **three phones** (dealer who also plays + two players), driving the real buttons. After every step it checks, on every phone, each stack as shown on the seats, the pot (`data-k="pot"`) and the stage label, plus that stacks + pot equal the chips at the table. Hand 1: blinds, preflop call/check, flop bet/call/fold (the flop bet flies exactly once on each other phone), turn, river, award. Hand 2: the button and blinds moved; three unequal stacks all-in, main pot and side pot awarded to different players through the award sheet, the excess returned. Hand 3 and 4: a cancelled hand (and a cancel right after the blinds) returns exactly what each player put in. Hand 5: a tied showdown on an odd pot (25) split between two winners, the odd chip goes to the first winner in seat order (13 and 12), chips at the table unchanged. Page errors on any phone fail it |
| `node tests/screenshots.js` | Seven players, a split and a double, in portrait, landscape and a small phone. Writes `tests/out/table-*.png`. **Look at them**: layout problems don't throw errors. Then runs the pixel comparison below and fails if a screen differs |
| `node tests/visual.js` | The pixel comparison on its own: 56 screens compared with `tests/baseline/*.png` using pixelmatch. The first ten (since phase 1): home empty and with a name, the Blackjack create form, the Blackjack scenario in portrait, landscape and small portrait, a Hold'em hand in portrait and landscape, the Players and Settings sheets. Then (phase 5) every sheet and its states (avatar, settle, blackjack now, end, cancel, award, players and settings as a guest), the home list with a table and with "צריך עדכון", the update and not-found screens, the join cards, the ceremony and the final card, the cloud header, the "new version" button, the install button, a toast, the sound off; and the Blackjack table's states: chips in hand on your spot, mid-round (insurance, a surrender, a blackjack paid at once) and paid (the result badges), no bet this round, a crowded table, an empty one, the closed table. A screen that differs leaves `tests/out/visual-<name>-actual.png` and `-diff.png`. `--only a,b` (or `ONLY=a,b`) runs some screens; `--jobs n` shoots n at a time (default 4). `--update` (also on `screenshots.js`) writes a new baseline: only for an intended visual change, after looking at the new images, and commit them |
| `node tests/behaviour.test.js` | What a render must keep now that Preact patches the page instead of replacing it: the caret and the avatar letter while you type your name, the landscape side panel (the same element, its scroll), a sheet's scroll (kept on a re-render, the top for another sheet), an amount typed in the Players sheet staying with its player, a closed sheet hidden and empty, the toast showing and hiding; at the Blackjack table, the table and the dealer kept across renders, each seat staying with its player when someone sits down, the blink's phase unchanged, chips from the tray landing on your spot one by one and the bet moving them onto it (the last three fail on the string views, which replaced everything) |
| `node tests/upgrade.test.js` | A phone on the old single-file version (commit `568fddc`, extracted into `tests/out/old-app/`) with its service worker installed and a table open; the same origin then serves `dist/` with a new `APP_BUILD`. Checks that the old app's update check reloads it into the new build, the table is still there, a new table can be created, the new service worker replaced `chips-v6` with its own cache of the hashed files, and the app opens offline |
| `node tests/guard.test.js` | The R-009 guard: a room with `appMin: 99` or an unknown `mode` shows the update screen (no controls, nothing but home/update acts), the phone makes **zero writes** to it (`hub.writes` in `tests/lib.js` logs every write the server received), it appears in the home list as "צריך עדכון" and renders normally once supported. `mode: 'chips'` plays as usual. Legacy proof: on a Blackjack room with `phase: 'cards'` and a Hold'em room with `stage: 'cards'` a player's taps cause no writes (the same taps on normal tables do write, as controls) |
| `node tests/audio.js` | Renders 60 s of the random casino one-shots offline through the app's master chain and prints the average level, the loudest 50 ms and the number of events (`tests/out/ambience.wav`), plus 10 s of three narration lines over the background (`tests/out/narration.wav`). Files that don't exist yet print `missing: …`. `AUDIO_PLACEHOLDERS=1` serves generated tones instead of the real files. The background's numbers vary by a few dB from run to run (which machine plays, when, panned where); `AUDIO_SEED=<n>` makes them repeatable, so two builds can be compared number for number |

`tests/out/` is git-ignored.

**How the pixel comparison stays deterministic.** Each screen gets a fresh browser context at device scale 1 with
service workers blocked, web fonts blocked (the fallback fonts are used, the same every run), and an init script
that seeds `Math.random` and `crypto.getRandomValues` (so room codes and player ids repeat), starts `Date.now` at a
fixed date, and makes every CSS animation and transition jump to its end (no caret either). The script waits until
no chips are flying before taking the picture; screens whose set-up adds players wait for the toast to go. Then it lays
out `#app` and `#sheet` afresh (`display: none` and back, scroll positions and focus kept): Chrome reuses the layout
and paint of elements a render kept, and a kept element that only moved with its parent (a dock row when the fixed
dock grows) can come out 1 px off where a fresh layout draws it, which is sub-pixel snapping rather than anything a
player sees. Two runs on unchanged code differ by zero pixels, four screens at a time as well as one; the tolerance is
zero differing pixels after pixelmatch's own anti-aliasing allowance (`MAX_DIFF` in `tests/visual.js`).

## How the two-phone test works

Each "phone" is a separate browser context, so it has its own localStorage and its own player identity.
The test serves a fake `config.js` and replaces the Firebase SDK with `tests/fakefs.js`, a small stand-in
for the parts of the compat SDK the Firestore adapter uses (held to the store contract above). Every write on one phone is copied to the others through
`exposeFunction` (`tests/lib.js`), which is how the real server behaves from the app's point of view.

This catches what single-device mode can't: one phone drawing something differently from another, data
that doesn't survive the trip, and anything that depends on the order snapshots arrive.

`openTable()` in `tests/lib.js` does the shared set-up (create the table as the dealer, everyone else opens the invite link and sits) for either game; the dealer's name is `names[0]`, and `settings` takes `stack`, `sb`, `bb`, `min`, `max`.

Limits: it doesn't reproduce Firestore's exact timing, offline caching, or security rules. Check those on
real phones against the real project.

## When to test what

- Anything other players see (bets, stacks, payouts, avatars, closing): the two-phone test, extended with
  a check for the new behaviour.
- Layout: `tests/screenshots.js` and look at the images; also open the app at phone size in a browser. A
  refactor must keep the pixel comparison at zero; an intended change takes a new baseline (`--update`).
- New or changed sounds: `tests/audio.js`; compare levels with the chip sounds, then listen. Moving sound code without
  changing it: `AUDIO_SEED=1 node tests/audio.js` before and after must print the same numbers.
- A new effect or event: a case in `src/sync/diff.test.ts` for the document change, and the two-phone (or Hold'em)
  test for what the other phone shows.
- Start-up changes: open the home screen and a table fresh (cleared storage). A start-up crash shows as a
  page error in every script.
- The build, the service worker, `config.js` or anything about loading: `tests/upgrade.test.js`, and
  `npm run build && npm run preview` by hand.

## Pitfalls

- The test server must send `text/css` for `.css`: a stylesheet served as `application/octet-stream` is ignored
  and the page renders unstyled without any error (`TYPES` in `tests/lib.js`).
- Navigating from `index.html` to `index.html#CODE` only changes the hash; the app doesn't reload. Open
  the invite link directly.
- After a re-render, element handles go stale. Use locators or selectors, not saved handles.
- Pages need a moment after each tap for the snapshot round trip (`waitForTimeout(300–800)`).
