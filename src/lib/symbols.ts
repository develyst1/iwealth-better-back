import { HttpError } from "./errors";

/** US equity tickers only: 1–5 uppercase letters, optional .class (BRK.B) */
const US_SYMBOL = /^[A-Z]{1,5}(\.[A-Z])?$/;

export function normalizeSymbol(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new HttpError(400, "symbol is required", "VALIDATION");
  }
  const symbol = raw.trim().toUpperCase();
  if (!US_SYMBOL.test(symbol)) {
    throw new HttpError(400, "US equity symbols only", "INVALID_SYMBOL");
  }
  return symbol;
}
