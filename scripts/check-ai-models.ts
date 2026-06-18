/**
 * AIモデル可用性チェック(定期実行/手動)。
 * lib/ai-models.ts の全モデルIDを Anthropic Models API で確認し、
 * 廃止(404)が1つでもあれば exit 1(=GitHub Actionsが失敗→メール通知)。
 *
 * 実行: ANTHROPIC_API_KEY=... npx tsx scripts/check-ai-models.ts
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { allModelIds } from "../lib/ai-models";

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("✗ ANTHROPIC_API_KEY が未設定です(GitHub Secrets を確認)");
    process.exit(2);
  }
  const client = new Anthropic({ apiKey });

  // 認証確認(キー無効なら全モデルGONE誤検知を避けて先に落とす)
  try {
    await client.models.list();
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403) {
      console.error(`✗ APIキーが無効です (status=${e?.status})`);
      process.exit(2);
    }
  }

  const ids = allModelIds();
  const missing: string[] = [];
  for (const id of ids) {
    try {
      await client.models.retrieve(id);
      console.log(`OK    ${id}`);
    } catch (e: any) {
      console.error(`GONE  ${id} (status=${e?.status})`);
      if (e?.status === 404) missing.push(id);
      else missing.push(`${id}(status=${e?.status})`);
    }
  }

  if (missing.length) {
    console.error(`\n❌ 廃止/不在のモデル: ${missing.join(", ")}`);
    console.error("→ lib/ai-models.ts の AI_MODEL_CHAINS を現行モデルへ更新してください。");
    process.exit(1);
  }
  console.log("\n✅ 全モデル利用可能");
}
main().catch((e) => { console.error(e); process.exit(1); });
