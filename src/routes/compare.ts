import { Hono } from "hono";
import { requireAuth, type AuthVars } from "../middleware/auth";
import { marketDataPort } from "../adapters/market-data";
import { eventPort, parseEventTypes } from "../adapters/events";
import { summarizeCompare } from "../adapters/llm";
import { resolveRange } from "../lib/dates";
import { normalizeSymbol } from "../lib/symbols";
import { HttpError } from "../lib/errors";
import type { CompareResult, EventType } from "../types/domain";

export const compareRoutes = new Hono<{ Variables: AuthVars }>();

compareRoutes.use("*", requireAuth);

compareRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    symbol?: unknown;
    from?: unknown;
    to?: unknown;
    eventTypes?: unknown;
  } | null;
  if (!body?.symbol) {
    throw new HttpError(400, "symbol is required", "VALIDATION");
  }
  const symbol = normalizeSymbol(body.symbol);
  const { from, to, clamped } = resolveRange(
    typeof body.from === "string" ? body.from : undefined,
    typeof body.to === "string" ? body.to : undefined,
  );
  let eventTypes: EventType[] = ["filing"];
  if (Array.isArray(body.eventTypes)) {
    eventTypes = parseEventTypes(body.eventTypes.map(String));
  } else if (typeof body.eventTypes === "string") {
    eventTypes = parseEventTypes(body.eventTypes);
  }

  const [bars, events] = await Promise.all([
    marketDataPort.getBars(symbol, from, to),
    eventPort.getEvents(symbol, from, to, eventTypes),
  ]);

  const result: CompareResult = {
    symbol,
    range: { from, to },
    bars,
    events,
    peers: [],
    ...(clamped ? { clamped: true } : {}),
  };
  return c.json(result);
});

compareRoutes.post("/summarize", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    compare?: CompareResult;
    question?: string;
  } | null;
  if (!body?.compare || typeof body.compare !== "object") {
    throw new HttpError(400, "compare payload required", "VALIDATION");
  }
  const compare = body.compare;
  if (
    !compare.symbol ||
    !Array.isArray(compare.bars) ||
    !Array.isArray(compare.events)
  ) {
    throw new HttpError(
      400,
      "compare must include symbol, bars, events",
      "VALIDATION",
    );
  }
  const out = await summarizeCompare(
    compare,
    typeof body.question === "string" ? body.question : undefined,
  );
  return c.json(out);
});
