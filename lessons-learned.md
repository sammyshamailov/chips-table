# Lessons learned

Mistakes made while building this app, what they cost, and the rule that prevents them. Newest at the
bottom of each section. Add to it whenever something breaks in a way that could happen again.

## Start-up and rendering

**Render runs before the rest of the script has loaded.** `dbReady` is an async IIFE with no `await`
before its first `render()`, so it renders synchronously while the script is still being read. A
`const`/`let` declared further down is still in its temporal dead zone: "Cannot access 'X' before
initialization", and the app is stuck on the home screen. Hit three times (`rotEl`, `newBuild`, the
avatar helpers). *Rule:* anything a render can reach goes above the `local single-device store` section
or is a `function` declaration. Every test script reports page errors, so this shows up at once.

**A full re-render resets the DOM.** `#app` is rebuilt with `innerHTML` on every update. Consequences
we hit:
- The landscape side panel jumped back to the top whenever another player acted. Fix: save and restore
  its `scrollTop` around the render.
- CSS animations restart; the dealer would never blink during busy play. Fix: a negative
  `animation-delay` computed from the clock, so the phase continues across renders.
- A file input inside a sheet is detached if a table update arrives while the photo picker is open, and
  its `change` event never reaches the document listener. Fix: the inputs live permanently outside `#app`.
- Element handles in tests go stale; use selectors.

**Measure before the render, animate after it.** Chips have to fly from where a spot *was* to where it
*is*. `render()` records every `[data-k]` position first (`FX.rects`); handlers use those for "from" and
the fresh DOM for "to". `FX.ov` keeps showing the old stack until the flying chips land.

**A stray character in generated HTML can break a feature silently.** A replacement left
`style=""background:…"` in the shared `avatar()` helper, so every small avatar lost its colour, and it
shipped that way for several releases. No error is thrown for broken attributes. *Rule:* look at the
screenshots of every screen that uses a changed helper, not just the one being worked on.

**Set `box-sizing: border-box` from the start.** Inputs with `width: 100%` plus padding and border were
wider than their cards from the first version: the name and chips fields stuck out and the two blind
fields overlapped. It showed in my own test screenshots and I didn't notice; the user did. Now global.
*Rule:* look at every screenshot for edges that don't line up, not only the feature being tested; the
overflow check in a test (every input inside its card, page no wider than the screen) catches it in numbers.

## Stored data and sync

**Store what the player did, not something derived from it.** Bets were stored as amounts and drawn by
making up the amount from the biggest chips, so five 1-chips appeared as one 5. The chips placed are now
stored with the bet (`hands[i].chips`), with the amount as fallback.

**Old and new versions share a table.** Every data change has been additive with a fallback (`chips`,
`paid`, `closed`, `final`, `avatar`), so a phone still on an older version keeps working. Keep it that way.

**Installed web apps keep running old code.** After a deploy, phones that resumed the app from the
background kept the old version; the bettor (on the new version) saw their exact chips while everyone else
saw the old stacks. It looked like a sync bug. Fix: `APP_BUILD` in `config.js` and a self-update check.
*Rule:* when one phone sees something different, first check the version (Settings shows it).

**Mark money that has already moved.** Paying a blackjack mid-round created three places that could pay
or refund it again: the end-of-round payout, a cancelled round, and the payout animation. The hand carries
`paid: true` and all three skip it. *Rule:* when adding a way to move chips, search every function that sums
`hands` or refunds bets.

**A dealer write must not assume the player's document is unchanged.** The dealer wrote each player's stack
as `p.stack + pay` from its own copy, and opened the next round before the players were paid. A player who bet
in that gap had the bet erased and the old hand left in the new round: chips from nowhere. *Rule:* dealer
changes to a player's chips are increments (`inc(n)`); settle the players first and open the next round last;
mark a settled player (`bjPaidRound`) so a retry doesn't pay twice. The test harness had to relay single
writes (not whole copies of the database) with a delay hook to reproduce it (`tests/race.test.js`).

**Keep new data inside the documents the rules already allow.** `firestore.rules` only opens `rooms` and
their `players`. A new collection would need the owner to paste new rules into the Firebase console, and
writes would fail until then. Avatars are stored on the player document instead (kept small on purpose).

## Layout

**Spread seats by distance along the arc, not by angle.** Equal angles put the circles at the bottom of
the table on top of each other with five or more players. `seatLayout` spaces them by arc length and
shrinks circles for big tables.

**A fixed bottom dock hides the table on short screens.** In portrait your own seat can sit under the
dock; chips for you fly to your chip count instead when the seat isn't visible (`onScreen`). In landscape
the dock becomes a side panel.

**Don't reveal the end before the show.** The table rendered as closed the moment the dealer ended the game,
so the "closed" sign and the standings were visible behind the drumroll. `FX.cer` keeps the table looking
open until the ceremony is dismissed.

## Sound

**Measure the mix; don't guess.** The casino background was mostly a constant room-tone layer, 21 dB
louder than the crowd and 38 dB louder than the slot machines, so players heard white noise. Rendering each
layer offline and measuring it found it in one step. *Rule:* run `node tests/audio.js` after changing any
sound, and send a rendered preview to listen to before shipping.

**A continuous bed is fine only if it is speech-like and very quiet.** (Update: the owner liked the generated talk
clips and asked for that style all the way through, quieter, so the background is now a looped generated murmur
at about −41 dBFS, 6 dB under the talk clip he liked, with a slot machine now and then.) The note below is what
went wrong with a loud, noisy bed.

**A continuous ambience bed reads as noise on a phone speaker.** Even a real casino recording looped at -32 dBFS
was called "too noisy". Sparse, quiet, randomly timed events (a machine, a few words, a laugh, with silence between)
read as a real room. *Rule:* for background atmosphere, schedule short one-shots instead of looping a bed, and
measure both the average level and the event peaks.

**Synthesized voices don't sound like people.** The crowd was built from buzzing oscillators shaped by vowel
formants; players said it sounded like aliens, and that it chattered too often. Nothing short of real speech
fixes that. *Rule:* realistic ambience comes from a recording (CC0, source in `sounds/CREDITS.md`); synthesis
is for effects. Pick recordings by measuring them (level spread, spikes, rumble, hiss), and still let the user
listen before shipping.

**An MP3 doesn't loop cleanly on its own.** Even a loop cut with a perfect crossfade gets a small jump at the
seam after MP3 encoding, because the codec changes the first and last frames. Crossfade the seam again after
decoding (`loopBounds`), and check it by playing across the loop point (largest sample step vs a typical one).

**Browsers only start audio after a touch.** The AudioContext is created and resumed on the first
`pointerdown`/`touchend`/`click`; until then sounds are silently skipped. iPhones are silent with the mute
switch on.

## Rolling out new table types

**A new table type needs its guard shipped first.** A phone on an older version shows any room as a chips table and
will happily bet into it. Before a table type with different rules exists, every phone must already refuse rooms it
doesn't understand (`mode` / `appMin`, R-009), and the new tables should also set the old fields (`phase` / `stage`
= `'cards'`) to values the old code won't act on. Ship the guard, wait until phones have updated, then ship the type.

## Build and deploy

**A dev server answers a missing file with `index.html`.** Vite's dev server and `vite preview` fall back to the page
for any unknown path by default, so a missing `config.js` (single-device mode) arrived as HTML: a syntax error instead
of the 404 Netlify gives. `appType: 'mpa'` in `vite.config.mts` turns the fallback off. *Rule:* local servers should
answer like the real host, or tests and manual checks see a different app.

**Everything in `public/` is published.** Moving `sounds/` there whole would have put `CREDITS.md` on the site; it
stays at `sounds/CREDITS.md`. *Rule:* after a build change, list `dist/` and check nothing private or dev-only is in it.

**Moving a classic script into a module changes two things.** Module code is strict mode (an undeclared variable or a
function declared inside a block behaves differently) and it runs deferred. Before the move the script was linted for
both (`no-undef`, `no-inner-declarations`); the deferred start runs at the same point the old end-of-body script did.

## Testing

**Single-device mode can't catch sync bugs.** It shares one database between all seats on one phone. The
two-phone harness (separate browser contexts, writes relayed between them) is the only local way to see what
another player sees.

**Hash-only navigation doesn't reload the app.** Going from `/index.html` to `/index.html#CODE` in a test
never re-ran the app. Open the invite link directly.

**A scripted find-and-replace that matches nothing fails silently.** A changelog edit looked for text that an
earlier, blocked commit would have written; it matched nothing, and the changelog stayed wrong for a release.
*Rule:* every scripted replacement asserts it matched exactly once.

**A stylesheet with the wrong content type is ignored without an error.** After the move to Vite the test server sent
`.css` as `application/octet-stream`; every screen rendered unstyled, with no page error. The other tests check the DOM,
not the styles; the pixel comparison failed on all ten screens at once. *Rule:* compare pixels, not just "no page errors", after any change to how files are
built or served.

**Background processes don't survive between commands in some environments.** The local test server kept
disappearing between tool calls. The test scripts now start their own server in-process.
