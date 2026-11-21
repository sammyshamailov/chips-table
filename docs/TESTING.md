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
| `node tests/two-phones.test.js` | A blackjack table on **two separate phones** that sync: avatars (character and photo), exact chip stacks seen by the other phone, deal, paying a blackjack mid-round, the payout not paying it twice, house balance, ending the game, the ceremony on the other phone, and a reloaded phone seeing the closed table. Prints PASS/FAIL per check and exits 1 on any failure |
| `node tests/screenshots.js` | Seven players, a split and a double, in portrait, landscape and a small phone. Writes `tests/out/table-*.png`. **Look at them**: layout problems don't throw errors |
| `node tests/audio.js` | Renders the casino background offline, prints the level of each layer (and how much is above 4 kHz, i.e. hiss), and writes `tests/out/ambience.wav` to listen to |

`tests/out/` is git-ignored.

## How the two-phone test works

Each "phone" is a separate browser context, so it has its own localStorage and its own player identity.
The test serves a fake `config.js` and replaces the Firebase SDK with `tests/fakefs.js`, a small stand-in
for the parts of Firestore the app uses. Every write on one phone is copied to the others through
`exposeFunction` (`tests/lib.js`), which is how the real server behaves from the app's point of view.

This catches what single-device mode can't: one phone drawing something differently from another, data
that doesn't survive the trip, and anything that depends on the order snapshots arrive.

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
