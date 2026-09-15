import type { CompareResult } from "../types/domain";
import { HttpError } from "../lib/errors";

export type SummarizeResponse = {
  content: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
};

/**
 * Proxy to https://ai.develyst.online/chat (back only).
 * 503 if LLM_GATEWAY_URL missing. Never invent prices / invest advice in prompt.
 */
export async function summarizeCompare(
  compare: CompareResult,
  question?: string,
): Promise<SummarizeResponse> {
  const base = process.env.LLM_GATEWAY_URL?.replace(/\/$/, "");
  if (!base) {
    throw new HttpError(
      503,
      "LLM gateway not configured (set LLM_GATEWAY_URL)",
      "LLM_UNAVAILABLE",
    );
  }

  const system = [
    "You summarize market compare evidence for iwealth-better.",
    "Use ONLY the bars and events provided in the user message.",
    "Never invent or predict future prices.",
    "Never give unconditional investment advice (buy/sell/hold recommendations).",
    "If data is insufficient, say so clearly.",
    "Respond in the language of the user question; default Thai if unspecified.",
  ].join(" ");

  const evidence = {
    symbol: compare.symbol,
    range: compare.range,
    barCount: compare.bars.length,
    firstBar: compare.bars[0] ?? null,
    lastBar: compare.bars[compare.bars.length - 1] ?? null,
    // Sample up to 12 bars evenly to keep prompt small
    barSample: sampleBars(compare.bars, 12),
    events: compare.events,
    peers: compare.peers ?? [],
  };

  const userContent = [
    question?.trim() || "สรุปหลักฐานจาก bars และ events ที่ให้มาโดยย่อ",
    "",
    "CompareResult evidence (JSON):",
    JSON.stringify(evidence),
  ].join("\n");

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const auth = process.env.LLM_GATEWAY_AUTH;
  if (auth) {
    headers.authorization = auth.startsWith("Bearer ")
      ? auth
      : `Bearer ${auth}`;
  }

  let res: Response;
  try {
    res = await fetch(`${base}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (err) {
    throw new HttpError(
      503,
      `LLM gateway unreachable: ${err instanceof Error ? err.message : String(err)}`,
      "LLM_UNREACHABLE",
    );
  }

  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: {
      content?: string;
      provider?: string;
      model?: string;
      latency_ms?: number;
    };
    error?: string;
  } | null;

  if (!res.ok || !body?.success || !body.data?.content) {
    throw new HttpError(
      503,
      body?.error ?? `LLM gateway error (${res.status})`,
      "LLM_ERROR",
    );
  }

  return {
    content: body.data.content,
    provider: body.data.provider,
    model: body.data.model,
    latency_ms: body.data.latency_ms,
  };
}

function sampleBars<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (arr.length - 1)) / (n - 1));
    out.push(arr[idx]);
  }
  return out;
}
