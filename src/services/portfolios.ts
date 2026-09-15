import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { holdings, portfolios } from "../db/schema";
import { HttpError } from "../lib/errors";
import { normalizeSymbol } from "../lib/symbols";
import type { Holding, Portfolio } from "../types/domain";

function mapPortfolio(row: typeof portfolios.$inferSelect): Portfolio {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapHolding(row: typeof holdings.$inferSelect): Holding {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    symbol: row.symbol,
    quantity: Number(row.quantity),
    avgCost: Number(row.avgCost),
  };
}

/** Ownership: missing or other user's → 404 (stable choice, see README) */
export async function requireOwnedPortfolio(
  userId: string,
  portfolioId: string,
) {
  const rows = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.id, portfolioId))
    .limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId) {
    throw new HttpError(404, "Portfolio not found", "NOT_FOUND");
  }
  return row;
}

export async function listPortfolios(userId: string): Promise<Portfolio[]> {
  const rows = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId));
  return rows.map(mapPortfolio);
}

export async function createPortfolio(
  userId: string,
  name: string,
): Promise<Portfolio> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new HttpError(400, "name is required", "VALIDATION");
  }
  const [row] = await db
    .insert(portfolios)
    .values({ userId, name: trimmed })
    .returning();
  return mapPortfolio(row);
}

export async function getPortfolioDetail(userId: string, portfolioId: string) {
  const row = await requireOwnedPortfolio(userId, portfolioId);
  const hs = await db
    .select()
    .from(holdings)
    .where(eq(holdings.portfolioId, portfolioId));
  return {
    ...mapPortfolio(row),
    holdings: hs.map(mapHolding),
  };
}

export async function patchPortfolio(
  userId: string,
  portfolioId: string,
  name: string,
): Promise<Portfolio> {
  await requireOwnedPortfolio(userId, portfolioId);
  const trimmed = name.trim();
  if (!trimmed) {
    throw new HttpError(400, "name is required", "VALIDATION");
  }
  const [row] = await db
    .update(portfolios)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(portfolios.id, portfolioId))
    .returning();
  return mapPortfolio(row);
}

export async function deletePortfolio(
  userId: string,
  portfolioId: string,
): Promise<void> {
  await requireOwnedPortfolio(userId, portfolioId);
  await db.delete(portfolios).where(eq(portfolios.id, portfolioId));
}

export async function upsertHolding(
  userId: string,
  portfolioId: string,
  input: { symbol: unknown; quantity: unknown; avgCost: unknown },
): Promise<Holding> {
  await requireOwnedPortfolio(userId, portfolioId);
  const symbol = normalizeSymbol(input.symbol);
  const quantity = Number(input.quantity);
  const avgCost = Number(input.avgCost);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new HttpError(400, "quantity must be > 0", "VALIDATION");
  }
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    throw new HttpError(400, "avgCost must be ≥ 0", "VALIDATION");
  }

  const [row] = await db
    .insert(holdings)
    .values({
      portfolioId,
      symbol,
      quantity: quantity.toFixed(6),
      avgCost: avgCost.toFixed(6),
    })
    .onConflictDoUpdate({
      target: [holdings.portfolioId, holdings.symbol],
      set: {
        quantity: quantity.toFixed(6),
        avgCost: avgCost.toFixed(6),
      },
    })
    .returning();

  await db
    .update(portfolios)
    .set({ updatedAt: new Date() })
    .where(eq(portfolios.id, portfolioId));

  return mapHolding(row);
}

export async function deleteHolding(
  userId: string,
  portfolioId: string,
  symbolRaw: string,
): Promise<void> {
  await requireOwnedPortfolio(userId, portfolioId);
  const symbol = normalizeSymbol(symbolRaw);
  const deleted = await db
    .delete(holdings)
    .where(
      and(eq(holdings.portfolioId, portfolioId), eq(holdings.symbol, symbol)),
    )
    .returning();
  if (deleted.length === 0) {
    throw new HttpError(404, "Holding not found", "NOT_FOUND");
  }
  await db
    .update(portfolios)
    .set({ updatedAt: new Date() })
    .where(eq(portfolios.id, portfolioId));
}
