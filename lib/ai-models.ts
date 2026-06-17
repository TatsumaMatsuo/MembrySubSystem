/**
 * Anthropic モデルID 集約。
 *
 * モデルは定期的に「非推奨(deprecated)」→「廃止(retired)」となり、
 * 廃止後は API が 404 を返す(=ルートで500化)。日付付きID(...-20250514)は特に廃止対象。
 * 廃止/移行時は **このファイルの値だけ** 更新すればよい(各ルートでハードコードしない)。
 *
 * 現行モデル(2026-06時点):
 *  - OCR_SCHEDULE: claude-sonnet-4-6  (画像読取+思考。旧 claude-sonnet-4-20250514 は 2026-06-15 廃止)
 *  - TEXT_ANALYSIS: claude-haiku-4-5  (テキスト総評。旧 claude-3-haiku-20240307 は 2026-04-19 廃止)
 *
 * 参照: /claude-api skill のモデル表、または platform.claude.com のモデル一覧。
 */
export const AI_MODELS = {
  /** 社内工程表OCR(画像から日付列を読取・thinking使用) */
  OCR_SCHEDULE: "claude-sonnet-4-6",
  /** AI分析・原価分析などのテキスト総評生成 */
  TEXT_ANALYSIS: "claude-haiku-4-5",
} as const;

export type AiModelKey = keyof typeof AI_MODELS;
