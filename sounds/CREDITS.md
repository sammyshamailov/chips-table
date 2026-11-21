# Sound credits

## casino-floor.mp3

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
