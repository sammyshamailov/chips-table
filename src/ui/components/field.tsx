/** A labelled number field bound to the state (`data-bind`, handled by the app's input listener). */
interface NumFieldProps {
  id: string;
  /** `create.stack`, `edit.bb`… */
  bind: string;
  label: string;
  value: string;
}

export function NumField({ id, bind, label, value }: NumFieldProps) {
  return (
    <label class="field">
      <span class="label">{label}</span>
      <input id={id} data-bind={bind} inputMode="numeric" value={value} style="direction:ltr" />
    </label>
  );
}
