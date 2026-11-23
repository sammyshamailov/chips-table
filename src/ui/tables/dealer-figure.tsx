/** The dealer: an original illustration standing behind the table. Her nod is `dealerNod` (src/fx/room.ts). */
import { useState } from 'preact/hooks';

/** The blink is a 5.2 s CSS animation; a negative delay taken from the clock keeps every phone's rhythm on time. */
const BLINK_MS = 5200;
export const blinkDelay = (now: number): string => `animation-delay:-${((now % BLINK_MS) / 1000).toFixed(2)}s`;

/**
 * The figure. The blink's phase is taken once, when the figure appears: Preact keeps the element on later renders, so
 * the animation runs on undisturbed (changing the delay of a running animation would make it jump).
 */
export function DealerFigure() {
  const [phase] = useState(() => blinkDelay(Date.now()));
  return (
    <svg class="dsvg" viewBox="0 0 120 110" aria-hidden="true">
      <defs>
        <linearGradient id="dg-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f2c8a6" />
          <stop offset="1" stop-color="#dca783" />
        </linearGradient>
      </defs>
      <path d="M52.5 52H67.5L68 66Q60 70 52 66Z" fill="#d49e7b" />
      <path d="M16 110C16 80 32 63 60 63S104 80 104 110Z" fill="#f4f1ea" />
      <path d="M16 110C16 82 30 66 48 63.5L60 90V110Z" fill="#17171c" />
      <path d="M104 110C104 82 90 66 72 63.5L60 90V110Z" fill="#17171c" />
      <circle cx="60" cy="94" r="1.2" fill="#e0b766" />
      <circle cx="60" cy="102" r="1.2" fill="#e0b766" />
      <rect x="75" y="80" width="12" height="4.2" rx="1" fill="#e0b766" />
      <path d="M51 62L60 70L55 76L46 65Z" fill="#fff" />
      <path d="M69 62L60 70L65 76L74 65Z" fill="#fff" />
      <path d="M60 70L50.5 65.5V74.5ZM60 70L69.5 65.5V74.5Z" fill="#b3203c" />
      <circle cx="60" cy="70" r="2.3" fill="#86152d" />
      <g class="dhead">
        <circle cx="60" cy="11.5" r="8.5" fill="#3a2217" />
        <path d="M53 13Q60 9 67 13" stroke="#5a3626" stroke-width="1.2" fill="none" />
        <ellipse cx="44.6" cy="39" rx="3" ry="4.2" fill="#e0ab88" />
        <ellipse cx="75.4" cy="39" rx="3" ry="4.2" fill="#e0ab88" />
        <ellipse cx="60" cy="37" rx="15.5" ry="18.5" fill="url(#dg-skin)" />
        <path d="M44 38C41 19 51 15.5 60 15.5S79 19 76 38C75 30 71 25 64 24C57 27 50 30 44 38Z" fill="#3a2217" />
        <path d="M64 24C58 26.5 52 29.5 47 34C51 28 57 25 64 24Z" fill="#5a3626" />
        <circle cx="44.6" cy="45.2" r="1.8" fill="#e0b766" />
        <circle cx="75.4" cy="45.2" r="1.8" fill="#e0b766" />
        <path
          d="M49.5 32.3Q53.5 30.1 57 32.1M63 32.1Q66.5 30.1 70.5 32.3"
          stroke="#3a2217"
          stroke-width="1.3"
          fill="none"
          stroke-linecap="round"
        />
        <ellipse cx="53.5" cy="37.6" rx="2" ry="2.5" fill="#2a1a12" />
        <ellipse cx="66.5" cy="37.6" rx="2" ry="2.5" fill="#2a1a12" />
        <circle cx="54.2" cy="36.7" r=".75" fill="#fff" />
        <circle cx="67.2" cy="36.7" r=".75" fill="#fff" />
        <path d="M51.3 36.3L49.8 35.1M68.7 36.3L70.2 35.1" stroke="#2a1a12" stroke-width=".9" stroke-linecap="round" />
        <g class="lids" style={phase}>
          <ellipse cx="53.5" cy="37.4" rx="2.7" ry="3.1" fill="#edc19e" />
          <ellipse cx="66.5" cy="37.4" rx="2.7" ry="3.1" fill="#edc19e" />
        </g>
        <path d="M60 39.5Q58.8 43.5 60.8 44.2" stroke="#c48a68" stroke-width=".9" fill="none" stroke-linecap="round" />
        <ellipse cx="50.6" cy="44.6" rx="3" ry="1.8" fill="#f08a8a" opacity=".35" />
        <ellipse cx="69.4" cy="44.6" rx="3" ry="1.8" fill="#f08a8a" opacity=".35" />
        <path d="M55.4 47.6Q60 52.2 64.6 47.6Q60 49.4 55.4 47.6Z" fill="#c2414f" />
      </g>
    </svg>
  );
}
