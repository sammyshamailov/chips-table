/** A table opened by a newer version of the app (R-009): update to join it, or go home. Nothing else acts here. */
export function UpdateView({ code }: { code: string }) {
  return (
    <div class="stack" style="padding-top:40px">
      <div class="card" id="needupd">
        <h2 style="font-family:var(--f-display);font-size:34px">השולחן הזה צריך גרסה חדשה יותר</h2>
        <span class="muted">{`השולחן ${code} נפתח בגרסה חדשה של האפליקציה. כדי להצטרף אליו צריך לעדכן.`}</span>
        <button class="btn primary wide" data-a="upd">
          עדכון
        </button>
        <button class="btn ghost wide" data-a="home">
          חזרה למסך הראשי
        </button>
      </div>
    </div>
  );
}
