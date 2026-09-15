/** Domain shapes aligned with iwealth-better-spec docs/domain/model.md */

export type EventType = "filing" | "news" | "earnings" | "other";

export type PriceBar = {
  symbol: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Event = {
  id: string;
  symbol: string;
  type: EventType;
  occurred_at: string; // ISO-8601 UTC
  title: string;
  summary?: string;
  url?: string;
  source: string;
  meta?: Record<string, unknown>;
};

export type CompareResult = {
  symbol: string;
  range: { from: string; to: string };
  bars: PriceBar[];
  events: Event[];
  peers?: unknown[];
  /** Present when request window was clamped to ≤2y */
  clamped?: boolean;
};

export type UserPublic = {
  id: string;
  email: string;
  createdAt: string;
};

export type Portfolio = {
  id: string;
  userId: string;
  name: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type Holding = {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
};
