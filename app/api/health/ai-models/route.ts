import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { allModelIds } from "@/lib/ai-models";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/ai-models
 * lib/ai-models.ts の全モデルIDが Anthropic Models API に存在するか確認する。
 * 廃止(404)されたモデルがあれば 503 + missing[] を返す。手動確認や外部監視のpoll先。
 */
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY 未設定" }, { status: 500 });
  }
  const client = new Anthropic({ apiKey });
  const models = await Promise.all(
    allModelIds().map(async (id) => {
      try {
        await client.models.retrieve(id);
        return { id, available: true as const };
      } catch (e: any) {
        return { id, available: false as const, status: e?.status ?? null };
      }
    }),
  );
  const missing = models.filter((m) => !m.available).map((m) => m.id);
  return NextResponse.json(
    { ok: missing.length === 0, missing, models },
    { status: missing.length ? 503 : 200 },
  );
}
