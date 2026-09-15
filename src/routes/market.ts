import { Hono } from "hono";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { marketDataPort } from "../adapters/market-data";
import { eventPort, parseEventTypes } from "../adapters/events";
import { resolveRange } from "../lib/dates";
import { normalizeSymbol } from "../lib/symbols";

export const marketRoutes = new Hono<{ Variables: AuthVars }>();

marketRoutes.use("*", requireAuth);

marketRoutes.get("/bars", async (c) => {
  const symbol = normalizeSymbol(c.req.query("symbol"));
  const { from, to, clamped } = resolveRange(
    c.req.query("from") || undefined,
    c.req.query("to") || undefined,
  );
  const bars = await marketDataPort.getBars(symbol, from, to);
  return c.json({ bars, range: { from, to }, clamped: clamped || undefined });
});

marketRoutes.get("/events", async (c) => {
  const symbol = normalizeSymbol(c.req.query("symbol"));
  const { from, to, clamped } = resolveRange(
    c.req.query("from") || undefined,
    c.req.query("to") || undefined,
  );
  const types = parseEventTypes(c.req.query("types"));
  const events = await eventPort.getEvents(symbol, from, to, types);
  return c.json({ events, range: { from, to }, clamped: clamped || undefined });
});
