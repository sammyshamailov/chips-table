# CLAUDE.md

Guidance for working on this repository. Read `lessons-learned.md` before changing anything that touches
start-up, rendering, stored data or sound: most of the rules below were learned the hard way there.

## What this is

**צ'יפים** is a chip table for home games of Texas Hold'em and Blackjack. The cards are real and on the
table; the app only replaces the chips. Each player uses their own phone; the dealer (whoever opened the
table) runs the round. Hebrew, right-to-left, phone first.

- Static PWA, built by Vite from `src/` (R-005 is splitting it into modules, phase by phase). For now
  the app's code is still mostly one script, `src/legacy.ts` (moved from the old `index.html`), with
  the game rules in `src/domain/` and the styles in `src/styles/`; `index.html` is the shell.
- Firebase Firestore (compat SDK from gstatic) syncs the table between phones in real time.
  Without a Firebase config the app runs in **single-device mode** (`LocalDB` in localStorage).
- Hosted on Netlify: `npm run build && node scripts/build-config.js dist`, publishing `dist/`.
  `config.js` (Firebase settings, `APP_BUILD`) stays a separate, unbundled file next to `index.html`.
- The players play live from `main`. **Develop on a side branch and push to `main` only when the user
  says so.** Netlify deploys `main`.

## Files

| Path | What |
|---|---|
| `index.html` | The shell: head, the elements the script needs, `config.js` and the Firebase compat scripts (classic scripts), then `src/main.ts` |
| `src/main.ts` | Entry point: imports the styles and the app, registers the service worker (build only) |
| `src/legacy.ts` | The app script (state, writes, views, sounds, animations), moved from `index.html`; it calls the game rules in `src/domain/`. `// @ts-nocheck` until later phases |
| `src/domain/` | The game rules as pure, typed functions with unit tests beside them: `chips.ts`, `holdem/` (`rules.ts`, `pots.ts`), `blackjack/` (`rules.ts`, `actions.ts`, `round.ts`), `types.ts` (the stored documents). Commands return the fields to write or a refusal code |
| `src/styles/*.css` | The styles, split at their old section comments, imported in order by `main.ts` |
| `src/sw-template.js` | Service worker: network-first for the app's own files, cache as offline fallback. `dist/sw.js` is generated from it |
| `scripts/sw-plugin.mts` | Vite plugin that writes `dist/sw.js`: the install list is the built files (hashed names), the cache name follows the build. Unit tested |
| `vite.config.mts`, `tsconfig*.json`, `eslint.config.mjs`, `.prettierrc` | Build (and Vitest, coverage), TypeScript (strict; `tsconfig.domain.json` checks `src/domain/` without DOM types), lint (with the domain purity rules) and format settings |
| `public/` | Copied as is to the site root: `icons/`, `manifest.webmanifest`, `sounds/` (`amb/` casino background: a looped crowd-murmur bed and slot-machine one-shots; `voice/` Hebrew dealer narration) |
| `scripts/build-config.js` | Netlify build: writes `config.js` (into the folder given, `dist` on Netlify) from env vars, plus `APP_BUILD` (commit) used for self-updates |
| `config.example.js` | Template for local testing with a real Firebase project |
| `firestore.rules` | Security rules. Only `rooms/{CODE}` and `rooms/{CODE}/players/{pid}` are reachable. Changing them means the owner pastes them in the Firebase console, so avoid it |
| `netlify.toml` | Build command, publish folder `dist`, Node version, cache headers |
| `sounds/CREDITS.md` | The source and licence of every sound in `public/sounds/` (kept outside `public/` so it isn't published) |
| `tests/` | Browser tests with Playwright, run against the build (see `docs/TESTING.md`); `tests/baseline/` holds the reference screenshots |
| `docs/ARCHITECTURE.md` | How the app is organised, the stored data model, flows, effects, sound |
| `docs/TESTING.md` | How to test, including two phones syncing |
| `lessons-learned.md` | Bugs and mistakes worth not repeating |
| `ROADMAP.md` | Every planned update and fix, each with a detailed plan. New work starts as an entry here |
| `CHANGELOG.md` | What changed, newest first |
| `README.md` | Setup and play instructions for the owner, in Hebrew |

## Rules

1. **Stored data stays compatible.** Phones on different versions share a table mid-game. Only *add*
   optional fields; never rename, remove or change the meaning of existing ones. Every reader of a new
   field needs a fallback for when it's missing or wrong (example: `hands[i].chips` falls back to the
   amount when it doesn't add up). Document new fields in `docs/ARCHITECTURE.md`.
2. **Start-up order.** `render()` runs synchronously while `src/legacy.ts` is still loading (inside the
   `dbReady` IIFE). Anything a render touches must be declared above the
   `/* ---------- local single-device store` section, or be a hoisted `function` declaration or an import.
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
6. **Sound**: effects (chips, bell, fanfare…) are synthesized with Web Audio. Anything that should sound
   like real people or a real place uses a recording: synthesized voices sounded like aliens. Only CC0 or
   clearly licensed audio; record the source in `sounds/CREDITS.md`. The background is a very quiet
   looped crowd murmur (`crowd-bed.mp3`, about −41 dBFS) plus a slot machine every 10–25 s. Keep the bed quiet and
   speech-like: a louder or noisier bed reads as noise. The
   dealer's narration (`SND.say`) is triggered from the change→animation code so every phone says it.
   Measure before shipping (`node tests/audio.js`): background about −38 dBFS average, narration about
   −20 dBFS, both under the chip sounds.
7. **Hebrew copy**: short, plain, gender-neutral where it matters (`את/ה`, `ניצח/ה`).
8. **Test before pushing**: `npm run lint`, `npm run typecheck`, `npm test` (unit tests; `npm run coverage` after a rule change), `node tests/two-phones.test.js`, `node tests/race.test.js`, `node tests/holdem.test.js` (any Hold'em change), `node tests/guard.test.js` (anything about room fields or opening a table), `node tests/upgrade.test.js` (anything about start-up, the service worker, `config.js` or the build), `node tests/screenshots.js`, and look at the
   screenshots. The browser tests build the app first (`SKIP_BUILD=1` reuses `dist/`). `screenshots.js` also compares
   ten screens with `tests/baseline/` pixel by pixel; take a new baseline (`--update`) only for an intended visual
   change, after looking at the new images. A single-device test can't catch sync bugs; use the two-phone harness
   for anything that other players see.
9. Keep `CHANGELOG.md`, `docs/ARCHITECTURE.md` and `lessons-learned.md` up to date in the same change.
10. **Game rules are pure, in `src/domain/`.** No DOM, Firebase, timers, clock (`Date.now`: pass `now` in), randomness,
    `S`, or imports from outside `src/domain/` (ESLint and `tsconfig.domain.json` enforce it). A rule returns the fields
    to write or a refusal code; the caller writes (dealer stack changes as `inc(n)`) and shows the text. Every rule
    change gets a unit test; keep side pots and payouts at full branch coverage.
11. **Plan in `ROADMAP.md` first.** Every update or fix gets an entry with a full plan before code is
    written; keep its status and steps current while building, and move it to Done when it reaches `main`.

## Working with the owner

- The owner and friends play live from `main` (Netlify deploys it). Work on a side branch and push to
  `main` only when the owner says so.
- Delegate the work (implementation, testing, research) to cheaper, faster subagents running in the
  background, so the main conversation stays free to talk with the owner. The main session plans, gives
  precise instructions, checks the results (test output, screenshots) and reports back.
- ElevenLabs is connected (MCP) for sound: speech, sound effects, music. Each generation costs the owner
  credits: use it only when a recording or synthesized sound can't do the job, generate one take at a time,
  send the owner a preview before shipping, and record anything generated in `sounds/CREDITS.md`.

## Running locally

```
npm install
npm run dev                        # Vite dev server; open the address it prints
npm run build && npm run preview   # the built site (dist/), as Netlify serves it
```

Without `config.js` the app is in single-device mode: the dealer can add players and "שחק בתור"
(play as) them from the same phone. To use a real Firebase project locally, copy `config.example.js`
to `config.js` and fill it in (it is git-ignored). `npm run dev` serves it from the repo root; for
`npm run preview`, write it into `dist/` (`node scripts/build-config.js dist` with the env vars set, or copy it).
