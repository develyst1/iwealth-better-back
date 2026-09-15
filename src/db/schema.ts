import {
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("portfolios_user_id_idx").on(t.userId)],
);

export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    avgCost: numeric("avg_cost", { precision: 18, scale: 6 }).notNull(),
  },
  (t) => [
    unique("holdings_portfolio_symbol_uidx").on(t.portfolioId, t.symbol),
    index("holdings_portfolio_id_idx").on(t.portfolioId),
    check("holdings_quantity_positive", sql`${t.quantity} > 0`),
    check("holdings_avg_cost_nonneg", sql`${t.avgCost} >= 0`),
  ],
);
