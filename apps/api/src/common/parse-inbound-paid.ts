/**
 * Case-insensitive match for "paid <amount>" with optional thousands separators.
 */
const PAID_RE = /\bpaid\s+([\d,]+(?:\.\d{1,2})?)\b/i;

export function parsePaidAmount(messageText: string): { amount: string } | null {
  const m = messageText.match(PAID_RE);
  if (!m) return null;
  const raw = m[1].replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  return { amount: raw };
}
