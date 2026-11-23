# Sound credits

## casino-floor.mp3 (removed)

No longer in the repo: replaced by the generated `sounds/amb/crowd-bed.mp3` (below) on 2026-11-22. Kept here as a record
of what the app once played.

- **Source:** "Casino Floor, Phoenix AZ (Audio Field Recording) [mono]" by mhtaylor67, Freesound sound 277444:
  https://freesound.org/s/277444/
- **License:** Creative Commons 0 (public domain dedication). No attribution required; credited here anyway.
- **Why this one:** of five CC0 casino recordings measured, it was the steadiest (1.5 dB level spread, no loud
  spikes), with its energy in the voice range and little rumble or hiss.
- **How the loop was made:** 75 s taken from 0:15, the last 4 s crossfaded (equal power) into the start,
  high-pass 110 Hz and low-pass 9 kHz, normalised to −20 dBFS RMS, encoded as mono MP3 64 kb/s (600 KB).
  The app crossfades another 50 ms at the seam after decoding (`loopBounds` in `index.html`), because MP3
  changes the first and last milliseconds slightly.

Everything else (chip clacks, slides, bell, drumroll, fanfare, applause) is synthesized in `index.html`.

## Generated with ElevenLabs

Generated on 2026-11-21. The audio in `sounds/voice/` and `sounds/amb/` was generated for this app with
ElevenLabs on the owner's account (one take each), then trimmed, faded, peak-normalised and encoded as mono
44.1 kHz MP3 64 kb/s with ffmpeg.

- **Narration voice:** Danit - Natural Israeli Hebrew, voice_id `s0T0DT6EAPeX57MQpn3I`
- **Narration model:** `eleven_v3`
- **Sound-effects model:** `eleven_text_to_sound_v3`

### sounds/voice/ (narration, Hebrew)

| File | Text |
| --- | --- |
| open.mp3 | הימורים פתוחים |
| locked.mp3 | אין יותר הימורים |
| blackjack.mp3 | בלאק ג'ק! |
| payout.mp3 | משלמת לזוכים |
| winner.mp3 | יש לנו מנצח! |
| newhand.mp3 | יד חדשה |
| flop.mp3 | פלופ |
| turn.mp3 | טרן |
| river.mp3 | ריבר |
| allin.mp3 | אול אין! |
| closed.mp3 | השולחן נסגר. תודה ששיחקתם! |

### sounds/amb/ (casino ambience, prompt suffix "in a large calm casino room, no music bed, about N seconds" omitted where noted)

| File | Prompt |
| --- | --- |
| machine-1.mp3 | a single slot machine spinning its reels and stopping, three soft clunks, distant, in a large calm casino room, no music, about 4 seconds |
| machine-2.mp3 | a slot machine playing a short cheerful electronic win jingle, distant, in a large calm casino room, no music bed, about 3 seconds |
| machine-3.mp3 | a slot machine jackpot with ringing bells and coins dropping into a metal tray, distant, in a large calm casino room, no music bed, about 5 seconds |
| machine-4.mp3 | a slot machine idle attract chime, soft electronic arpeggio, distant, in a large calm casino room, no music bed, about 3 seconds |
| talk-1.mp3 (removed) | two people talking quietly at a nearby table in a large calm casino room, indistinct words, no music bed, about 6 seconds |
| talk-2.mp3 (removed; its style is what crowd-bed.mp3 imitates) | a man and a woman chatting softly in a large calm casino room, muffled, no clear words, no music bed, about 6 seconds |
| talk-3.mp3 (removed) | a small group murmuring quietly and one soft chuckle, distant, in a large calm casino room, no music bed, about 6 seconds |
| laugh-1.mp3 (removed) | a short soft laugh from a woman across a large calm casino room, distant, no music bed, about 2 seconds |

The talk and laugh one-shots (talk-1..3, laugh-1) were replaced by `crowd-bed.mp3` and deleted from the repo.

### sounds/amb/crowd-bed.mp3 (steady background murmur, generated 2026-11-21)

- **Model:** `eleven_text_to_sound_v3`, `duration_seconds` 22, `prompt_influence` 0.3, `loop` off; two separate takes
  (one generation each, flow `QqUVSYVXnFtuBTlluwBX`).
- **Prompt (both takes):** a continuous steady murmur of a man and a woman and other people chatting softly in a
  large calm casino room, muffled, no clear words, no pauses, no music bed, about 22 seconds
  (the talk-2 prompt, which the owner liked, asked for a steady murmur with no pauses).
- **How it was made:** take 1 and take 2 joined with a 2 s equal-power crossfade (42 s), high-pass 120 Hz and
  low-pass 7 kHz, then the last 3 s crossfaded (equal power) into the start so it loops (39 s), normalised to
  −20 dBFS RMS, mono 44.1 kHz MP3 64 kb/s (312 KB). At the loop point the largest sample step is 0.0056 against a
  typical (median) step of 0.0068; the app crossfades another 50 ms after decoding (`loopBounds`).
- **In the app:** played at about −41 dBFS at the master chain (6 dB under the talk-2 event as heard in the
  earlier preview, −35 dBFS), looped, fading in over 3 s.
