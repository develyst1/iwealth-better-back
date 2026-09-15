import { Hono } from "hono";
import { cors } from "hono/cors";
import { HttpError } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { portfolioRoutes } from "./routes/portfolios";
import { marketRoutes } from "./routes/market";
import { compareRoutes } from "./routes/compare";

export const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, service: "iwealth-better-back" }));
// Spec also lists GET /health under /api/v0
app.get("/api/v0/health", (c) => c.json({ ok: true }));

const v0 = new Hono();
v0.route("/auth", authRoutes);
v0.route("/portfolios", portfolioRoutes);
v0.route("/market", marketRoutes);
v0.route("/compare", compareRoutes);

app.route("/api/v0", v0);

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(
      { error: err.message, code: err.code ?? "ERROR" },
      err.status as 400,
    );
  }
  console.error(err);
  return c.json({ error: "Internal Server Error", code: "INTERNAL" }, 500);
});

app.notFound((c) => c.json({ error: "Not Found", code: "NOT_FOUND" }, 404));
