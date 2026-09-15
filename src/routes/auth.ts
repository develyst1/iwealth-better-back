import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { HttpError } from "../lib/errors";
import { signJwt } from "../lib/jwt";
import { jwtSecret, requireAuth, type AuthVars } from "../middleware/auth";
import type { UserPublic } from "../types/domain";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublic(row: typeof users.$inferSelect): UserPublic {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
  };
}

export const authRoutes = new Hono<{ Variables: AuthVars }>();

authRoutes.post("/register", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;
  const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
    throw new HttpError(400, "Invalid email", "VALIDATION");
  }
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters", "VALIDATION");
  }

  const email = emailRaw.toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new HttpError(409, "Email already registered", "EMAIL_TAKEN");
  }

  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
  });
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning();

  const token = await signJwt(row.id, row.email, jwtSecret());
  return c.json({ user: toPublic(row), token }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;
  const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!emailRaw || !password) {
    throw new HttpError(400, "email and password required", "VALIDATION");
  }

  const email = emailRaw.toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new HttpError(401, "Invalid credentials", "UNAUTHORIZED");
  }
  const ok = await Bun.password.verify(password, row.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid credentials", "UNAUTHORIZED");
  }

  const token = await signJwt(row.id, row.email, jwtSecret());
  return c.json({ user: toPublic(row), token });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  // JWT is stateless — client drops token. Endpoint exists for contract parity.
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  }
  return c.json({ user: toPublic(row) });
});
