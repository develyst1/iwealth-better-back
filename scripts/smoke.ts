/**
 * Smoke against running local server + DB.
 * Usage: bun run smoke  (expects PORT, default 3010)
 */
const BASE = `http://127.0.0.1:${process.env.PORT ?? 3010}`;
const API = `${BASE}/api/v0`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function json(res: Response, label?: string) {
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${label ?? ""} ${res.status} ${JSON.stringify(body)}`);
  }
  return body as Record<string, unknown>;
}

async function main() {
  console.log("smoke →", BASE);
  const email = `smoke-${Date.now()}@example.com`;
  const password = "password123";

  // Health
  assert((await fetch(`${BASE}/health`)).ok, "root health");
  assert((await fetch(`${API}/health`)).ok, "api health");

  // Auth fail: short password
  {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "bad@example.com", password: "short" }),
    });
    assert(r.status === 400, "short password → 400");
  }

  // Register
  const reg = await json(
    await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    "register",
  );
  assert(typeof reg.token === "string", "register token");
  let token = reg.token as string;

  // Duplicate email
  {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert(r.status === 409, "dup email → 409");
  }

  // Login
  const login = await json(
    await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    "login",
  );
  token = login.token as string;
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  // Me
  const me = await json(await fetch(`${API}/auth/me`, { headers: auth }), "me");
  assert((me.user as { email: string }).email === email, "me email");

  // No token → 401
  assert((await fetch(`${API}/portfolios`)).status === 401, "portfolios 401");
  assert((await fetch(`${API}/auth/me`)).status === 401, "me 401");

  // Bad login
  assert(
    (
      await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "wrong-password" }),
      })
    ).status === 401,
    "bad login 401",
  );

  // Portfolios
  const emptyName = await fetch(`${API}/portfolios`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ name: "  " }),
  });
  assert(emptyName.status === 400, "empty name 400");

  const pA = await json(
    await fetch(`${API}/portfolios`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: "Portfolio A" }),
    }),
    "create A",
  );
  const pB = await json(
    await fetch(`${API}/portfolios`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ name: "Portfolio B" }),
    }),
    "create B",
  );
  const list = await json(await fetch(`${API}/portfolios`, { headers: auth }), "list");
  assert(Array.isArray(list.items) && (list.items as unknown[]).length >= 2, "≥2 portfolios");

  const patched = await json(
    await fetch(`${API}/portfolios/${pA.id}`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ name: "Portfolio A2" }),
    }),
    "patch",
  );
  assert(patched.name === "Portfolio A2", "patched name");

  // Holdings
  const h = await json(
    await fetch(`${API}/portfolios/${pA.id}/holdings`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ symbol: "aapl", quantity: 10, avgCost: 150 }),
    }),
    "holding",
  );
  assert(h.symbol === "AAPL" && h.quantity === 10, "holding upsert");

  const h2 = await json(
    await fetch(`${API}/portfolios/${pA.id}/holdings`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ symbol: "AAPL", quantity: 12, avgCost: 155 }),
    }),
    "holding update",
  );
  assert(h2.quantity === 12 && h2.avgCost === 155, "holding updated");

  {
    const r = await fetch(`${API}/portfolios/${pA.id}/holdings`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ symbol: "AAPL", quantity: 0, avgCost: 1 }),
    });
    assert(r.status === 400, "qty 0 → 400");
  }

  const detail = await json(
    await fetch(`${API}/portfolios/${pA.id}`, { headers: auth }),
    "detail",
  );
  assert(Array.isArray(detail.holdings) && (detail.holdings as unknown[]).length === 1, "1 holding");

  await json(
    await fetch(`${API}/portfolios/${pA.id}/holdings/AAPL`, {
      method: "DELETE",
      headers: auth,
    }),
    "del holding",
  );

  await json(
    await fetch(`${API}/portfolios/${pB.id}`, { method: "DELETE", headers: auth }),
    "del B",
  );

  // Isolation: second user cannot see A's portfolio
  const other = await json(
    await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `other-${Date.now()}@example.com`,
        password: "password123",
      }),
    }),
    "other reg",
  );
  const otherAuth = {
    authorization: `Bearer ${other.token}`,
    "content-type": "application/json",
  };
  assert(
    (
      await fetch(`${API}/portfolios/${pA.id}`, { headers: otherAuth })
    ).status === 404,
    "cross-user 404",
  );

  // Market / compare
  {
    const r = await fetch(`${API}/market/bars?symbol=AAA.TH`, { headers: auth });
    // AAA.TH fails US pattern
    assert(r.status === 400, "non-US symbol 400");
  }

  const bars = await json(
    await fetch(`${API}/market/bars?symbol=AAPL`, { headers: auth }),
    "bars",
  );
  assert(Array.isArray(bars.bars) && (bars.bars as unknown[]).length > 100, "many bars");

  const events = await json(
    await fetch(`${API}/market/events?symbol=AAPL&types=filing`, { headers: auth }),
    "events",
  );
  assert(Array.isArray(events.events), "events array");

  const events2 = await json(
    await fetch(
      `${API}/market/events?symbol=AAPL&types=filing,news,earnings`,
      { headers: auth },
    ),
    "events multi",
  );
  assert(Array.isArray(events2.events), "multi events");

  const compare = await json(
    await fetch(`${API}/compare`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ symbol: "MSFT" }),
    }),
    "compare",
  );
  assert(
    compare.symbol === "MSFT" &&
      Array.isArray(compare.bars) &&
      Array.isArray(compare.events),
    "CompareResult shape",
  );

  // summarize: either content or clear 503
  {
    const r = await fetch(`${API}/compare/summarize`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ compare, question: "สรุปสั้น ๆ" }),
    });
    const body = (await r.json()) as Record<string, unknown>;
    if (r.status === 200) {
      assert(typeof body.content === "string" && body.content.length > 0, "summarize content");
      console.log("summarize → 200 (gateway ok)");
    } else {
      assert(r.status === 503, `summarize expected 200 or 503, got ${r.status}`);
      assert(typeof body.error === "string", "503 error message");
      console.log("summarize → 503", body.code ?? body.error);
    }
  }

  // empty summarize payload
  assert(
    (
      await fetch(`${API}/compare/summarize`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({}),
      })
    ).status === 400,
    "empty summarize 400",
  );

  // logout
  await json(
    await fetch(`${API}/auth/logout`, { method: "POST", headers: auth }),
    "logout",
  );

  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error("SMOKE FAIL", e);
  process.exit(1);
});
