/**
 * Optional seed — creates a demo user if none exists.
 * Password: demo-pass-123 (change in production; never commit real secrets)
 */
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

async function seed() {
  const email = "demo@iwealth.local";
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length === 0) {
    const passwordHash = await Bun.password.hash("demo-pass-123", {
      algorithm: "argon2id",
    });
    await db.insert(users).values({ email, passwordHash });
    console.log(`Seed: created demo user ${email} / demo-pass-123`);
  } else {
    console.log("Seed: demo user already present");
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
