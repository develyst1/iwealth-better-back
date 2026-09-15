import type { Event, EventType } from "../types/domain";
import { parseYmd, ymd, addDays } from "../lib/dates";
import { normalizeSymbol } from "../lib/symbols";

export interface EventPort {
  getEvents(
    symbol: string,
    from: string,
    to: string,
    types: EventType[],
  ): Promise<Event[]>;
}

const ALL_TYPES: EventType[] = ["filing", "news", "earnings", "other"];

export function parseEventTypes(raw?: string | string[]): EventType[] {
  if (!raw || (Array.isArray(raw) && raw.length === 0) || raw === "") {
    return ["filing"];
  }
  const parts = (Array.isArray(raw) ? raw.join(",") : raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: EventType[] = [];
  for (const p of parts) {
    if (!ALL_TYPES.includes(p as EventType)) {
      // ignore unknown for stub softness, but filing/news/earnings/other only
      continue;
    }
    if (!out.includes(p as EventType)) out.push(p as EventType);
  }
  return out.length ? out : ["filing"];
}

/**
 * Stub EventPort — synthetic SEC-shaped filings + sparse news/earnings samples.
 */
export class StubEventPort implements EventPort {
  async getEvents(
    symbol: string,
    from: string,
    to: string,
    types: EventType[],
  ): Promise<Event[]> {
    const sym = normalizeSymbol(symbol);
    const start = parseYmd(from);
    const end = parseYmd(to);
    const events: Event[] = [];

    if (types.includes("filing")) {
      // Place a few filings roughly quarterly inside the window
      const forms = ["10-K", "10-Q", "8-K", "10-Q", "8-K"] as const;
      let cursor = addDays(start, 45);
      let i = 0;
      while (cursor.getTime() <= end.getTime() && i < forms.length) {
        const form = forms[i % forms.length];
        const d = ymd(cursor);
        events.push({
          id: `stub-filing-${sym}-${d}-${form}`,
          symbol: sym,
          type: "filing",
          occurred_at: `${d}T21:00:00.000Z`,
          title: `${sym} ${form} filing (stub)`,
          summary: `Synthetic ${form} for ${sym} — stub adapter, not EDGAR.`,
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${sym}`,
          source: "stub",
          meta: {
            form,
            accession: `0000000000-${String(i).padStart(2, "0")}-000000`,
          },
        });
        cursor = addDays(cursor, 90);
        i++;
      }
    }

    if (types.includes("news")) {
      // Sparse sample mid-window
      const mid = new Date((start.getTime() + end.getTime()) / 2);
      if (mid.getTime() >= start.getTime() && mid.getTime() <= end.getTime()) {
        const d = ymd(mid);
        events.push({
          id: `stub-news-${sym}-${d}`,
          symbol: sym,
          type: "news",
          occurred_at: `${d}T14:30:00.000Z`,
          title: `${sym} stub headline`,
          summary: "Placeholder news event from stub adapter.",
          source: "stub",
        });
      }
    }

    if (types.includes("earnings")) {
      const mid = addDays(start, 120);
      if (mid.getTime() <= end.getTime()) {
        const d = ymd(mid);
        events.push({
          id: `stub-earnings-${sym}-${d}`,
          symbol: sym,
          type: "earnings",
          occurred_at: `${d}T20:00:00.000Z`,
          title: `${sym} earnings (stub)`,
          summary: "Placeholder earnings event.",
          source: "stub",
        });
      }
    }

    return events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  }
}

export const eventPort: EventPort = new StubEventPort();
