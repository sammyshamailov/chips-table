/** A row that is pressed or not: a check box, the text, and something on the far side. */
import type { ComponentChildren } from 'preact';

interface OptionProps {
  /** The action (`data-a`) and its value (`data-v`). */
  a: string;
  v?: string;
  pressed: boolean;
  children: ComponentChildren;
  /** What goes on the far side (an empty span by default). */
  end?: ComponentChildren;
}

export function Option({ a, v, pressed, children, end = <span></span> }: OptionProps) {
  return (
    <button class="opt" data-a={a} data-v={v} aria-pressed={pressed}>
      <span class="box"></span>
      <span>{children}</span>
      {end}
    </button>
  );
}
