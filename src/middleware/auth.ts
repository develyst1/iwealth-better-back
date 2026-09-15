import { createMiddleware } from "hono/factory";
import { verifyJwt } from "../lib/jwt";
import { HttpError } from "../lib/errors";

export type AuthVars = {
  userId: string;
  email: string;
};

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new HttpError(503, "JWT_SECRET not configured", "AUTH_MISCONFIG");
  }
  return s;
}

export const requireAuth = createMiddleware<{ Variables: AuthVars }>(
  async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const payload = await verifyJwt(m[1].trim(), jwtSecret());
    if (!payload) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    c.set("userId", payload.sub);
    c.set("email", payload.email);
    await next();
  },
);

export { jwtSecret };
