import Decimal from 'decimal.js';

export function money(v: string | number | Decimal): Decimal {
  return new Decimal(v);
}

/** Settlement normalization: floor to nearest ten (e.g. 2005 → 2000). */
export function settleToNearestTen(amount: Decimal): Decimal {
  return amount.div(10).floor().mul(10);
}

export function toDecimalString(d: Decimal): string {
  return d.toFixed(2);
}
