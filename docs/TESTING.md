# Testing

The tests drive the real `index.html` in headless Chromium with Playwright. Each script starts its own
static server, so nothing else needs to be running.

Setup once:

```
npm i -g playwright
npx playwright install chromium
```

## The scripts

| Command | What it checks |
|---|---|
| `node tests/race.test.js` | Money conservation (stacks + bets + house) when the dealer's player writes reach the server late and a player bets the moment the next round opens; for a paid and a cancelled round. Uses `hub.delay` in `tests/lib.js` |
| `node tests/two-phones.test.js` | A blackjack table on **two separate phones** that sync: avatars (character and photo), exact chip stacks seen by the other phone, deal, paying a blackjack mid-round, the payout not paying it twice, house balance, ending the game, the ceremony on the other phone, and a reloaded phone seeing the closed table. Prints PASS/FAIL per check and exits 1 on any failure |
| `node tests/holdem.test.js` | Texas Hold'em on **three phones** (dealer who also plays + two players), driving the real buttons. After every step it checks, on every phone, each stack as shown on the seats, the pot (`data-k="pot"`) and the stage label, plus that stacks + pot equal the chips at the table. Hand 1: blinds, preflop call/check, flop bet/call/fold, turn, river, award. Hand 2: the button and blinds moved; three unequal stacks all-in, main pot and side pot awarded to different players through the award sheet, the excess returned. Hand 3 and 4: a cancelled hand (and a cancel right after the blinds) returns exactly what each player put in. Page errors on any phone fail it |
| `node tests/screenshots.js` | Seven players, a split and a double, in portrait, landscape and a small phone. Writes `tests/out/table-*.png`. **Look at them**: layout problems don't throw errors |
| `node tests/guard.test.js` | The R-009 guard: a room with `appMin: 99` or an unknown `mode` shows the update screen (no controls, nothing but home/update acts), the phone makes **zero writes** to it (`hub.writes` in `tests/lib.js` logs every write the server received), it appears in the home list as "צריך עדכון" and renders normally once supported. `mode: 'chips'` plays as usual. Legacy proof: on a Blackjack room with `phase: 'cards'` and a Hold'em room with `stage: 'cards'` a player's taps cause no writes (the same taps on normal tables do write, as controls) |
| `node tests/audio.js` | Renders 60 s of the random casino one-shots offline through the app's master chain and prints the average level, the loudest 50 ms and the number of events (`tests/out/ambience.wav`), plus 10 s of three narration lines over the background (`tests/out/narration.wav`). Files that don't exist yet print `missing: …`. `AUDIO_PLACEHOLDERS=1` serves generated tones instead of the real files |

`tests/out/` is git-ignored.

## How the two-phone test works

Each "phone" is a separate browser context, so it has its own localStorage and its own player identity.
The test serves a fake `config.js` and replaces the Firebase SDK with `tests/fakefs.js`, a small stand-in
for the parts of Firestore the app uses. Every write on one phone is copied to the others through
`exposeFunction` (`tests/lib.js`), which is how the real server behaves from the app's point of view.

This catches what single-device mode can't: one phone drawing something differently from another, data
that doesn't survive the trip, and anything that depends on the order snapshots arrive.

`openTable()` in `tests/lib.js` does the shared set-up (create the table as the dealer, everyone else opens the invite link and sits) for either game; the dealer's name is `names[0]`, and `settings` takes `stack`, `sb`, `bb`, `min`, `max`.

Limits: it doesn't reproduce Firestore's exact timing, offline caching, or security rules. Check those on
real phones against the real project.

## When to test what

- Anything other players see (bets, stacks, payouts, avatars, closing): the two-phone test, extended with
  a check for the new behaviour.
- Layout: `tests/screenshots.js` and look at the images; also open the app at phone size in a browser.
- New or changed sounds: `tests/audio.js`; compare levels with the chip sounds, then listen.
- Start-up changes: open the home screen and a table fresh (cleared storage). A start-up crash shows as a
  page error in every script.

## Pitfalls

- Navigating from `index.html` to `index.html#CODE` only changes the hash; the app doesn't reload. Open
  the invite link directly.
- After a re-render, element handles go stale. Use locators or selectors, not saved handles.
- Pages need a moment after each tap for the snapshot round trip (`waitForTimeout(300–800)`).
