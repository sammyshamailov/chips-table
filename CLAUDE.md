# CLAUDE.md

Guidance for working on this repository. Read `lessons-learned.md` before changing anything that touches
start-up, rendering, stored data or sound: most of the rules below were learned the hard way there.

## What this is

**צ'יפים** is a chip table for home games of Texas Hold'em and Blackjack. The cards are real and on the
table; the app only replaces the chips. Each player uses their own phone; the dealer (whoever opened the
table) runs the round. Hebrew, right-to-left, phone first.

- Static PWA, no build step for the app itself. Almost everything lives in `index.html` (HTML, CSS and
  one script).
- Firebase Firestore (compat SDK from gstatic) syncs the table between phones in real time.
  Without a Firebase config the app runs in **single-device mode** (`LocalDB` in localStorage).
- Hosted on Netlify. The build only generates `config.js` (`scripts/build-config.js`).
- The players play live from `main`. **Develop on a side branch and push to `main` only when the user
  says so.** Netlify deploys `main`.

## Files

| Path | What |
|---|---|
| `index.html` | The whole app: styles, markup shell, game logic, views, sounds, animations |
| `sw.js` | Service worker: network-first for the app's own files, cache as offline fallback. Bump `CACHE` when the shell file list changes |
| `scripts/build-config.js` | Netlify build: writes `config.js` from env vars, plus `APP_BUILD` (commit) used for self-updates |
| `config.example.js` | Template for local testing with a real Firebase project |
| `firestore.rules` | Security rules. Only `rooms/{CODE}` and `rooms/{CODE}/players/{pid}` are reachable. Changing them means the owner pastes them in the Firebase console, so avoid it |
| `netlify.toml` | Build command, cache headers, and redirects that keep dev files off the site |
| `tests/` | Browser tests with Playwright (see `docs/TESTING.md`) |
| `docs/ARCHITECTURE.md` | How `index.html` is organised, the stored data model, flows, effects, sound |
| `docs/TESTING.md` | How to test, including two phones syncing |
| `lessons-learned.md` | Bugs and mistakes worth not repeating |
| `CHANGELOG.md` | What changed, newest first |
| `README.md` | Setup and play instructions for the owner, in Hebrew |

## Rules

1. **Stored data stays compatible.** Phones on different versions share a table mid-game. Only *add*
   optional fields; never rename, remove or change the meaning of existing ones. Every reader of a new
   field needs a fallback for when it's missing or wrong (example: `hands[i].chips` falls back to the
   amount when it doesn't add up). Document new fields in `docs/ARCHITECTURE.md`.
2. **Start-up order.** `render()` runs synchronously while the script is still loading (inside the
   `dbReady` IIFE). Anything a render touches must be declared above the
   `/* ---------- local single-device store` section, or be a hoisted `function` declaration.
   A `const`/`let` declared later throws "Cannot access X before initialization" and the app stays on
   the home screen. This has happened three times.
3. **Rendering replaces `#app` and `#sheet` wholesale** (`innerHTML`). Never keep state in the DOM.
   Anything that must survive a re-render (file inputs, the ceremony overlay, flying chips, the rotate
   prompt) lives outside `#app`. CSS animations restart on every render: use a phase offset
   (negative `animation-delay`, see the dealer's blink) or WAAPI from the effects layer.
4. **Animations come from document changes.** Every player write sets `lastAction` and `ts`; the
   snapshot handler diffs old and new documents (`fxPlayers`, `fxRoom`) and plays the matching effect.
   A new player action must set both, and if chips move, add a handler in `fxBJ`/`fxHold`. Positions
   from before the render are in `FX.rects`; `FX.ov` holds what a spot showed before until chips land.
5. **Chips only.** No card visuals or card sounds. The cards are physical.
6. **Sounds are synthesized** (Web Audio, no files). Measure new sounds before shipping
   (`node tests/audio.js`); keep the background well under the chip sounds (about −35 dBFS now).
7. **Hebrew copy**: short, plain, gender-neutral where it matters (`את/ה`, `ניצח/ה`).
8. **Test before pushing**: `node tests/two-phones.test.js`, `node tests/screenshots.js`, and look at the
   screenshots. A single-device test can't catch sync bugs; use the two-phone harness for anything that
   other players see.
9. Keep `CHANGELOG.md`, `docs/ARCHITECTURE.md` and `lessons-learned.md` up to date in the same change.

## Running locally

```
python3 -m http.server 8000        # or any static server; open http://localhost:8000
```

Without `config.js` the app is in single-device mode: the dealer can add players and "שחק בתור"
(play as) them from the same phone. To use a real Firebase project locally, copy `config.example.js`
to `config.js` and fill it in (it is git-ignored).
