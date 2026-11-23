/** A whole number with thousands separators, as every amount in the app is shown: `1234.6` → `1,235`. */
export function fmt(n: number | null | undefined): string {
  return Math.round(n || 0).toLocaleString('en-US');
}
