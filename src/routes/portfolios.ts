import { Hono } from "hono";
import { requireAuth, type AuthVars } from "../middleware/auth";
import * as svc from "../services/portfolios";

export const portfolioRoutes = new Hono<{ Variables: AuthVars }>();

portfolioRoutes.use("*", requireAuth);

portfolioRoutes.get("/", async (c) => {
  const items = await svc.listPortfolios(c.get("userId"));
  return c.json({ items });
});

portfolioRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  const portfolio = await svc.createPortfolio(c.get("userId"), name);
  return c.json(portfolio, 201);
});

portfolioRoutes.get("/:id", async (c) => {
  const detail = await svc.getPortfolioDetail(c.get("userId"), c.req.param("id"));
  return c.json(detail);
});

portfolioRoutes.patch("/:id", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  const portfolio = await svc.patchPortfolio(
    c.get("userId"),
    c.req.param("id"),
    name,
  );
  return c.json(portfolio);
});

portfolioRoutes.delete("/:id", async (c) => {
  await svc.deletePortfolio(c.get("userId"), c.req.param("id"));
  return c.json({ ok: true });
});

portfolioRoutes.put("/:id/holdings", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    symbol?: unknown;
    quantity?: unknown;
    avgCost?: unknown;
  } | null;
  const holding = await svc.upsertHolding(c.get("userId"), c.req.param("id"), {
    symbol: body?.symbol,
    quantity: body?.quantity,
    avgCost: body?.avgCost,
  });
  return c.json(holding);
});

portfolioRoutes.delete("/:id/holdings/:symbol", async (c) => {
  await svc.deleteHolding(
    c.get("userId"),
    c.req.param("id"),
    c.req.param("symbol"),
  );
  return c.json({ ok: true });
});
