/** The room's header: the game and the connection status over the room code, the sound switch, Players and Settings. */

/** How this phone is connected: `cloud` with its sync state, or not connected at all (single-device mode). */
export interface Connection {
  mode: string;
  syncErr?: string | null;
  /** The room and its players have both arrived from the server (not just the local cache). */
  synced: boolean;
}

export function ConnStatus({ mode, syncErr, synced }: Connection) {
  if (mode !== 'cloud') return <span style="color:var(--danger)">● לא מחובר</span>;
  if (syncErr) return <span style="color:var(--danger)">{'שגיאה: ' + syncErr}</span>;
  return synced ? <span style="color:var(--ok)">● מחובר</span> : <span style="color:var(--brass)">● מתחבר…</span>;
}

const ICON = {
  width: '18',
  height: '18',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
} as const;

export function SoundIcon({ on }: { on: boolean }) {
  return on ? (
    <svg {...ICON}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ) : (
    <svg {...ICON}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </svg>
  );
}

interface HeaderProps {
  code: string;
  gameName: string;
  conn: Connection;
  soundOn: boolean;
}

export function RoomHeader({ code, gameName, conn, soundOn }: HeaderProps) {
  return (
    <div class="top">
      <button class="code-btn" data-a="copy" aria-label="העתקת קוד החדר">
        <small>
          {/* one text node: two adjacent ones are shaped (kerned) slightly differently */}
          {gameName + ' · '}
          <ConnStatus {...conn} />
        </small>
        <span class="code">{code}</span>
      </button>
      <div class="actions">
        <button
          class="btn small ghost icon-btn"
          data-a="snd"
          aria-label={soundOn ? 'השתקת צלילים' : 'הפעלת צלילים'}
          aria-pressed={soundOn}
        >
          <SoundIcon on={soundOn} />
        </button>
        <button class="btn small ghost" data-a="sheet" data-v="players">
          שחקנים
        </button>
        <button class="btn small ghost" data-a="sheet" data-v="settings">
          הגדרות
        </button>
      </div>
    </div>
  );
}
