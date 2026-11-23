/** The "closed" sign hanging over a table once the game has ended; it drops in just after the ceremony. */
export function ClosedSign({ drop }: { drop: boolean }) {
  return (
    <div class={'csign' + (drop ? ' drop' : '')} aria-label="השולחן סגור">
      <span>השולחן סגור</span>
    </div>
  );
}
