import { HttpError } from "./errors";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RANGE_DAYS = 365 * 2; // ≤2 years

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseYmd(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new HttpError(400, `Invalid date: ${s}`, "INVALID_DATE");
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, `Invalid date: ${s}`, "INVALID_DATE");
  }
  return d;
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Default = last 2 years ending today. Clamp windows longer than 2y (documented in README). */
export function resolveRange(
  from?: string,
  to?: string,
): { from: string; to: string; clamped: boolean } {
  const end = to ? parseYmd(to) : parseYmd(todayUtc());
  let start = from ? parseYmd(from) : addDays(end, -MAX_RANGE_DAYS);
  if (start.getTime() > end.getTime()) {
    throw new HttpError(400, "from must be ≤ to", "INVALID_RANGE");
  }
  const spanDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  let clamped = false;
  if (spanDays > MAX_RANGE_DAYS) {
    start = addDays(end, -MAX_RANGE_DAYS);
    clamped = true;
  }
  return { from: ymd(start), to: ymd(end), clamped };
}

/** Weekday iterator (skip Sat/Sun) for synthetic EOD bars */
export function* eachWeekday(from: string, to: string): Generator<string> {
  let cur = parseYmd(from);
  const end = parseYmd(to);
  while (cur.getTime() <= end.getTime()) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) yield ymd(cur);
    cur = addDays(cur, 1);
  }
}
