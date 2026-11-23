/** The short message at the bottom of the screen (`#toast`, outside the app so a render never hides it). */
import { render } from 'preact';

export function Toast({ text }: { text: string }) {
  return <>{text}</>;
}

/** Shows `text` in `el` for `ms`; a new message replaces the one showing and starts the time again. */
export function createToaster(el: HTMLElement, ms = 3200): (text: string) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return text => {
    render(<Toast text={text} />, el);
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (el.hidden = true), ms);
  };
}
