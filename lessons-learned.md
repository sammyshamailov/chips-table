# Lessons learned

Mistakes made while building this app, what they cost, and the rule that prevents them. Newest at the
bottom of each section. Add to it whenever something breaks in a way that could happen again.

## Start-up and rendering

**Render runs before the rest of the script has loaded.** `dbReady` is an async IIFE with no `await`
before its first `render()`, so it renders synchronously while the script is still being read. A
`const`/`let` declared further down is still in its temporal dead zone: "Cannot access 'X' before
initialization", and the app is stuck on the home screen. Hit three times (`rotEl`, `newBuild`, the
avatar helpers). *Rule (since R-005 phase 6, when the script became modules):* no module does work when it is
imported; `create…()` builds its part without rendering or listening, and `start()` (called last by `main.ts`) begins.
Every test script reports page errors, so a break shows up at once.

**A full re-render resets the DOM.** `#app` is rebuilt with `innerHTML` on every update. Consequences
we hit:
- The landscape side panel jumped back to the top whenever another player acted. Fix: save and restore
  its `scrollTop` around the render. (Since R-005 phase 5 the panel is a Preact element that stays, so the
  save/restore is gone; sheets keep their scroll too.)
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

**Keeping elements turns on the browser's scroll anchoring.** The string views replaced every element on each render,
so Chrome never adjusted the page's scroll to follow one. Once Preact kept the room's shell, Chrome started moving the
page to keep an element in place when the table above it changed size: a Hold'em screenshot came out 51 px lower and
the pixel comparison failed by 47,517 pixels. `overflow-anchor: none` on `#app` and the side panel keeps scrolling
exactly as before. *Rule:* when a render starts keeping elements it used to replace, compare scroll positions as well
as the picture.

**Two text nodes are not one.** `טקסס הולדם · ` written in JSX as `{name} · ` is two adjacent text nodes; Chrome kerned
the first letters four pixels differently from the single text the string view made. *Rule:* where the old HTML had
one run of text, the component builds one string (`{name + ' · '}`).

**A kept element can be drawn from Chrome's caches.** After the Blackjack dock became a component, the split scenario
differed from the baseline by 499 pixels: the first hand's buttons were 1 px lower, although every element's box was
the same to a thousandth of a pixel. The dock is fixed to the bottom, so when a split adds a row the whole dock moves up
by a fractional amount; the string view rebuilt the first row, Preact kept it, and Chrome reused its layout and paint,
snapped to the old sub-pixel position. Replacing that one row with a clone made the picture match. Nobody can see it on
a phone, so the pixel comparison now lays out `#app` and `#sheet` afresh before each picture, and the old build still
matches every baseline with that step. *Rule:* when pixels differ but the boxes don't, look for something kept rather
than rebuilt before changing the code; and a check that kept elements stay (`tests/behaviour.test.js`) belongs next
to the picture.

**A running animation is not restarted by a new delay; it jumps.** The dealer's blink took its phase from the clock in
every render (a negative `animation-delay`), which was right while each render built a new figure. Once Preact keeps
the figure, writing a new delay into a running animation shifts it instead: the blink would have jumped on every
update. The phase is now taken once, when the figure appears. *Rule:* anything a string view recomputed per render to
survive being rebuilt (phases, `scrollTop`, a class that replays an animation) needs a second look once the element is
kept.

**A helper fed the wrong shape draws something plausible.** While moving the ceremony's winner circle to the Avatar
component (R-005 phase 5, part C), it turned out the ceremony passes the stored player document, which has no `pid`; the
colour behind the letter is worked out from the pid, so every winner without a picture has been shown on the colour of
the text "undefined" instead of their own. Nothing errors and it looks fine. It was kept as it is in the refactor (no
visible change allowed) and noted for a fix. *Rule:* when a helper takes an "owner" object, check every caller passes
the fields it reads, not just an object that type-checks loosely; `// @ts-nocheck` code hides exactly this. (Fixed in
R-005 phase 6: the ceremony passes each winner's document with its pid. With the app typed, `AvatarOwner` requires the
pid, so the old call no longer compiles.)

**Wire everything, then start.** Moving the effects into event subscribers meant they had to exist before the first
snapshot, and the sound engine and the effects layer need the app (`render`, `myId`, "inside a table") while the app
needs them. Rendering while the script was still loading would have made that a new start-up trap. Instead the app is
created first and started last (`createApp()`, the subscribers, then `app.start()` in `main.ts`), and the engine
and the layer call back into the app only from a touch, a timer or an event. *Rule:* creating a module never renders,
listens to the store or plays anything; `main.ts` decides when.

**Preact owns the children of what it renders into.** The ceremony rains chips by adding elements to `#fin`, which
Preact now renders the card into. Preact keeps a container's children in step with its own tree: a first render
there can remove children it didn't make, and a later one can insert its own between them. The rain goes into its own empty element (`display: contents`, so the chips are
still positioned against `#fin`), whose children Preact never looks at. *Rule:* anything added to the page by hand
goes into an element Preact renders empty, never next to Preact's own children.

**Logical insets follow the element's own direction, not its container's.** The language switch is positioned with
`inset-inline-end: 0` and carries `dir="ltr"` (so "EN / עב" reads the same in both languages); in Hebrew it landed on the
right, over the title, because its own direction made "inline end" the right side. It is placed physically by the
page's direction now. *Rule:* an element that sets its own `dir` or `direction` measures its logical properties
(insets, margins, padding) in that direction; position it from a wrapper, or physically.

**A shared class name can style the wrong thing for a long time.** The Hold'em row's dealer tag is `tag host`, and
`.host` is also the dealer-controls panel (padding, border, radius), so the tag is drawn as a big rounded box, in both
languages, since before R-005. Found while reviewing the English screenshots; left as it is (the Hebrew screens must not
change in R-006) for the Hold'em redesign (R-007). *Rule:* a modifier class gets a name that no block uses.

**Switching a default can switch it for everyone already playing.** The plan said "first run: Hebrew if the phone lists
Hebrew first, otherwise English". Many phones are set to English, so every player already at the table would have
opened the update in English. A phone that has used the app (it has a `chips.pid`) stays in Hebrew; only new phones
pick by their languages. The test browsers showed the same trap: their default locale is English, so every existing
test would have run in English; they now get a locale. *Rule:* a new setting's default is chosen for the people who
already use the app as well as for new ones, and the tests set it explicitly.

**Invisible and right-to-left characters don't survive edits by eye.** The house's balance in the event line sits
between U+2066 and U+2069 (direction isolates); a tool wrote an `\u2066` escape in a test as the character itself, and
a script meant to hold the Hebrew range as `\u0590-\u05FF` got the characters instead. Both still worked, which is the
problem: nobody can see them. *Rule:* spell invisible, direction and non-Latin characters in code as escapes, and check
the bytes (`od -c`) after a scripted edit.

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

**A fallback must keep "missing" readable where the code reads it.** Moving every fallback into `normalizeRoom` /
`normalizePlayer` (R-005 phase 3) looked like "missing → 0 or false" everywhere, but several readers tell missing apart
from a value: the guard treats a missing `appMin`/`mode` differently from any value (and a non-number `appMin` as too
new), the payout narration reads `roundEnd` only when it is there and the event text otherwise, `bjRound: null` and
`bjPaidRound` missing must never equal a round number. Those stay absent or `null`. And a normalised hand must not gain
flags: the Blackjack commands copy hands with `{...h}` and write them back whole, so a default `doubled: false` would
have been written into every rewritten hand. *Rule:* before giving a field a default, search every reader for
`== null`, `??`, `in`, `===` against another field, and for spreads that end up in a write; keep unknown fields too,
so a hand rewritten by an older phone keeps what a newer one added.

**Single-device mode merges maps; Firestore replaces them.** The old `LocalDB` (now `local-store.ts`) merges a nested
map on `update` field by field, while Firestore (and `tests/fakefs.js`) replace a map named in an update. The only maps
the app writes are whole `lastAction`/`lastEvent`/`final`/`avatar` objects, so on one phone a key can linger (a Hold'em
`lastAction.chips` from an earlier bet, drawn only if it happens to add up to the new amount); it was kept as it was,
for phones with offline tables, and the contract tests pin both behaviours.
*Rule:* never rely on either: write a map whole, with every key it should have.

**Text that other versions show must stay in the language they speak.** The event line under the header was a stored
Hebrew sentence. With English, each phone should show it in its own language, but phones on older versions show `t` as
it is. Writers now store a catalog key and its parameters (`lastEvent.key`, `.p`) and still write `t` in Hebrew, whatever
the writer's language; readers use the key when they know it and fall back to `t`. The two-phone test has a phone on the
old single-file version at the table to prove it. *Rule:* stored words are stored as a key plus parameters, with the
text old readers expect next to them; a stored key is never renamed.

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

**A guard that has never failed proves nothing.** `tsconfig.domain.json` was meant to make the DOM unavailable in
`src/domain/`, but it extended `tsconfig.json`, whose `jsxImportSource: preact` quietly loads Preact's types, which
pull in the DOM library: a test file using `document` compiled fine. Found only by adding a deliberate violation; the
domain config is now standalone. *Rule:* when adding a lint rule or a type check meant to forbid something, add a
throwaway file that breaks it and see it fail (the ESLint purity rules were checked the same way).

## Testing

**A random level is not a level.** After the sound code moved to `src/audio/`, `tests/audio.js` printed a background
3.6 dB quieter and its loudest moment 8.5 dB lower than before. Nothing was wrong: which slot machine plays, when, and
panned how far left are random, and the test measures the left channel. Running the old and the new build with the same
seeded `Math.random` gave the same numbers to the decimal. *Rule:* when code moves, compare with `AUDIO_SEED=<n>` (or any
seeded run), not two random runs; and a count check (exactly one flight per bet on the other phone) only proves something
once it has been seen to fail (it was: two flights with a doubled subscription, none with a missing one).

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

**A pixel baseline belongs to the machine that took it.** The pixel tests block web fonts so the text is drawn in the
fallback fonts, the same on every run; but "the same" holds only on one machine: fontconfig picks the fallback from
the fonts installed (here a Hebrew fallback the runner doesn't have), so a CI runner would differ on every screen with
text. CI photographs the earlier version on the runner and compares with that instead (`tests/visual-against.js`).
*Rule:* compare pictures taken on the same machine; check a new test machine by comparing the old version with
itself first.

**Background processes don't survive between commands in some environments.** The local test server kept
disappearing between tool calls. The test scripts now start their own server in-process.
