/**
 * The table's scale: `--u` is 1% of the table's width and `--tw` its width, set on the page so the whole table scales
 * as one picture (see docs/ARCHITECTURE.md, Layout). In portrait the table takes the screen's width (at most 520 px);
 * in landscape inside a table it is sized by the screen's height, leaving room for the side panel.
 */

/** The dealer above the table, as a share of the table's width. */
const DEALER_ABOVE = 0.185;
/** The table's height, as a share of its width. */
const TABLE_HEIGHT = 0.98;
/** The side panel's width in landscape (px). */
const SIDE_PANEL = 276;

export type TableScale = ReturnType<typeof createTableScale>;

/**
 * `app` is `#app`; `inRoom()` says whether a table is open. Creating it reads the screen's media queries and listens
 * to nothing; `start(onTurn)` listens for resizes and turns.
 */
export function createTableScale(app: HTMLElement, inRoom: () => boolean) {
  const LAND = matchMedia('(orientation: landscape)');
  const PORTRAIT_PHONE = matchMedia('(orientation: portrait) and (max-width: 700px) and (pointer: coarse)');

  function apply(): void {
    const aw = app.clientWidth || 340;
    let w = Math.min(aw, 520);
    if (LAND.matches && inRoom())
      w = Math.max(220, Math.min(600, (innerHeight - 20) / (TABLE_HEIGHT + DEALER_ABOVE), aw - SIDE_PANEL));
    const st = document.documentElement.style;
    st.setProperty('--u', (w / 100).toFixed(3) + 'px');
    st.setProperty('--tw', Math.floor(w) + 'px');
  }

  return {
    apply,
    /** A phone held upright (the turn-the-phone prompt). */
    portraitPhone: () => PORTRAIT_PHONE.matches,
    /** Rescales on resize; `onTurn` runs when the phone turns (or crosses the phone-size limit). */
    start(onTurn: () => void): void {
      window.addEventListener('resize', apply);
      [LAND, PORTRAIT_PHONE].forEach(q => {
        try {
          q.addEventListener('change', onTurn);
        } catch {
          try {
            q.addListener(onTurn);
          } catch {
            // the browser can't tell: the next render rescales
          }
        }
      });
    },
  };
}
