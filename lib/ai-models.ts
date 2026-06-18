/**
 * Anthropic モデルID 集約 ＋ 廃止に強い呼び出し。
 *
 * モデルは定期的に「非推奨(deprecated)」→「廃止(retired)」となり、廃止後は API が
 * 404 を返す(=ルートで500化)。日付付きID(...-20250514)は特に廃止対象。
 *
 * 対策:
 *  - 廃止/移行時は **このファイルの値だけ** 更新すればよい(各ルートでハードコードしない)。
 *  - createMessageWithFallback() が 404 を検知したら次候補へ自動フォールバックし、
 *    廃止が起きても 500 にならず動き続ける(設定更新までの猶予)。
 *  - allModelIds() を /api/health/ai-models と定期チェックで使い、廃止を事前検知する。
 *
 * 現行モデル(2026-06時点):
 *  - OCR_SCHEDULE  : claude-sonnet-4-6  (画像読取+思考。旧 claude-sonnet-4-20250514 は 2026-06-15 廃止)
 *  - TEXT_ANALYSIS : claude-haiku-4-5   (テキスト総評。旧 claude-3-haiku-20240307 は 2026-04-19 廃止)
 *
 * 参照: /claude-api skill のモデル表、または platform.claude.com のモデル一覧。
 */
import Anthropic from "@anthropic-ai/sdk";

/** モデル候補(先頭=優先)。先頭が404(廃止)なら順に次へフォールバックする。 */
export const AI_MODEL_CHAINS = {
  /** 社内工程表OCR(画像から日付列を読取・thinking使用) */
  OCR_SCHEDULE: ["claude-sonnet-4-6", "claude-opus-4-8"],
  /** AI分析・原価分析などのテキスト総評生成 */
  TEXT_ANALYSIS: ["claude-haiku-4-5", "claude-sonnet-4-6"],
} as const;

/** 各チェーンの優先(先頭)モデル。単発参照用。 */
export const AI_MODELS = {
  OCR_SCHEDULE: AI_MODEL_CHAINS.OCR_SCHEDULE[0],
  TEXT_ANALYSIS: AI_MODEL_CHAINS.TEXT_ANALYSIS[0],
} as const;

/** 全チェーンのモデルID(重複排除)。ヘルスチェック用。 */
export function allModelIds(): string[] {
  return [...new Set(Object.values(AI_MODEL_CHAINS).flat())];
}

/**
 * モデルを優先順に試行。404(not_found=廃止)なら次候補へフォールバックする。
 * 404以外のエラー(400/429/5xx等)はモデルを切り替えず即throw。
 */
export async function createMessageWithFallback(
  client: Anthropic,
  models: readonly string[],
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Message> {
  let lastErr: unknown;
  for (const model of models) {
    try {
      return await client.messages.create({ ...params, model });
    } catch (e: any) {
      if (e?.status === 404) {
        // モデル廃止の可能性 → 次候補へ。ログで気づけるようにする。
        console.error(`[ai-models] "${model}" not found (廃止の可能性)。次の候補へフォールバックします`);
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("利用可能なモデル候補がありません");
}
