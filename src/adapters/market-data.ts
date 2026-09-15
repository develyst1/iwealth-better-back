import type { PriceBar } from "../types/domain";
import { eachWeekday, parseYmd } from "../lib/dates";
import { normalizeSymbol } from "../lib/symbols";

export interface MarketDataPort {
  getBars(symbol: string, from: string, to: string): Promise<PriceBar[]>;
}

/** Deterministic FNV-1a style seed from symbol */
function seedFromSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stub MarketDataPort — synthetic EOD from seed(symbol).
 * No real vendor feeds.
 */
export class StubMarketDataPort implements MarketDataPort {
  async getBars(symbol: string, from: string, to: string): Promise<PriceBar[]> {
    const sym = normalizeSymbol(symbol);
    parseYmd(from);
    parseYmd(to);
    const rand = mulberry32(seedFromSymbol(sym));
    // Base price ~20–200 from seed
    let price = 20 + (seedFromSymbol(sym) % 180) + rand() * 5;
    const bars: PriceBar[] = [];
    for (const date of eachWeekday(from, to)) {
      const drift = (rand() - 0.48) * 0.02; // slight upward bias
      const open = price;
      const close = Math.max(1, open * (1 + drift));
      const high = Math.max(open, close) * (1 + rand() * 0.01);
      const low = Math.min(open, close) * (1 - rand() * 0.01);
      const volume = Math.floor(500_000 + rand() * 4_500_000);
      bars.push({
        symbol: sym,
        date,
        open: round2(open),
        high: round2(high),
        low: round2(low),
        close: round2(close),
        volume,
      });
      price = close;
    }
    return bars;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const marketDataPort: MarketDataPort = new StubMarketDataPort();
