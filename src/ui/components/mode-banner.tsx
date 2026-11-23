/** Connecting, or single-device mode (no Firebase config): a banner on the home screen and in the room. */
export function ModeBanner({ mode }: { mode: string }) {
  if (mode === 'pending') return <div class="banner">מתחבר לשרת…</div>;
  if (mode === 'local')
    return (
      <div class="banner">
        <b>מצב מכשיר אחד</b>
        <span class="muted">
          האפליקציה עוד לא מחוברת לשרת, אז הכל נשמר רק בטלפון הזה. כדי לשחק ביחד, מלאו את פרטי Firebase בקובץ config.js
          (ההוראות בקובץ README).
        </span>
        <button class="btn small ghost" data-a="retry">
          ניסיון חיבור מחדש
        </button>
      </div>
    );
  return null;
}
