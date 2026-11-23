/** A sheet's title with the close button. */
export function SheetHead({ title }: { title: string }) {
  return (
    <div class="sheet-head">
      <h2>{title}</h2>
      <button class="btn small ghost" data-a="close">
        סגירה
      </button>
    </div>
  );
}
