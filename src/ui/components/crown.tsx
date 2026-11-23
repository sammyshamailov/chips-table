/** The crown over the winner (the final card and the ceremony). */
export function Crown() {
  return (
    <svg class="crown" viewBox="0 0 64 40" aria-hidden="true">
      <path
        d="M4 34L8 8l14 13L32 3l10 18L56 8l4 26Z"
        fill="#e0b766"
        stroke="#8a6420"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <rect x="4" y="32" width="56" height="6" rx="2" fill="#c99a45" />
      <circle cx="32" cy="22" r="3.5" fill="#c8372d" />
      <circle cx="17" cy="25" r="2.6" fill="#2f5fb8" />
      <circle cx="47" cy="25" r="2.6" fill="#2e8a4f" />
    </svg>
  );
}
