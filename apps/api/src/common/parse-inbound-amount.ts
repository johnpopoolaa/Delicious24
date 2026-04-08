/**
 * Detects payment intent in a message and extracts the amount.
 *
 * Rules:
 *  - A payment keyword must appear anywhere in the message (case-insensitive).
 *  - k/K suffix multiplies by 1,000  (e.g. "5k" → 5000, "5.5K" → 5500).
 *  - Integers 1–99 are treated as thousands (e.g. "5" → 5000, "50" → 50000).
 *  - Integers ≥ 100 and decimal amounts are taken as-is.
 *  - Amounts are returned raw — no rounding is applied here.
 *  - If a keyword is present but no number is found, returns null (admin reviews).
 */

const KEYWORD_RE =
  /\b(paid|payment|sent|transfer(?:red)?|deposit(?:ed)?|remit(?:ted)?|settled|cleared)\b/i;

/** Matches an amount with an optional k/K suffix: e.g. 5k, 5.5K, 10K */
const AMOUNT_K_RE = /\b([\d,]+(?:\.\d+)?)\s*[kK]\b/;

/** Matches a plain number with optional thousands separator and up to 2 decimal places */
const AMOUNT_PLAIN_RE = /\b([\d,]+(?:\.\d{1,2})?)\b/;

export function parseInboundAmount(text: string): { amount: string } | null {
  if (!KEYWORD_RE.test(text)) return null;

  // k-suffix takes priority over plain number matching
  const kMatch = text.match(AMOUNT_K_RE);
  if (kMatch) {
    const raw = parseFloat(kMatch[1].replace(/,/g, ''));
    return { amount: String(raw * 1000) };
  }

  // Plain number
  const plainMatch = text.match(AMOUNT_PLAIN_RE);
  if (!plainMatch) return null; // keyword present but no number found

  const raw = plainMatch[1].replace(/,/g, '');
  const num = parseFloat(raw);

  // 1–99 integers are treated as thousands (common shorthand)
  if (Number.isInteger(num) && num >= 1 && num <= 99) {
    return { amount: String(num * 1000) };
  }

  return { amount: raw };
}
