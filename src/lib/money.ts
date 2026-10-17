// Prices are whole rupees everywhere (no paisa).
const formatter = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

export function formatRs(amount: number): string {
  return `Rs ${formatter.format(Math.round(amount))}`;
}

/** Percentage off for a compare-at price, or null when there is no saving. */
export function percentOff(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
