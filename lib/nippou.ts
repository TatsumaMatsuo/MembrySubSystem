// 現場作業日報システム データ層(F2-06 社内閲覧 / F2-07 案件別URL)
//
// - 現場作業日報(NIPPOU): フォーム投稿の蓄積先。売約番号で該当案件の有効日報を取得。
// - 現場作業日報_案件マスタ(NIPPOU_ANKEN): 案件別の配布情報。物件名/施工場所/営業担当者名/
//   現場chat_id は 売約情報(製番)からの Lookup(配列オブジェクト)なので値抽出する。
import { getBaseRecords, createBaseRecord, updateBaseRecord } from "./lark-client";
import { getLarkTables, getBaseTokenForTable } from "./lark-tables";
import { escapeLarkFilterValue } from "./lark-filter";

// 受付コード生成: 8桁英数字(紛らわしい 0/O/1/I/L を除外)。SEC-04 の推測困難な値。
const UKETSUKE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateUketsukeCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += UKETSUKE_ALPHABET[Math.floor(Math.random() * UKETSUKE_ALPHABET.length)];
  }
  return s;
}

// 現場作業日報 テーブルのフォーム外部共有URL(F2-07 で売約番号・受付コードを prefill する土台)
export const NIPPOU_FORM_SHARE_URL =
  process.env.NEXT_PUBLIC_NIPPOU_FORM_URL ||
  "https://osvn246ak4c.jp.larksuite.com/share/base/form/shrjplIkC6vaaTTRQFc0f4jXOOg";

/**
 * 案件別のフォームURL(F2-07)。共通フォームURLに 売約番号・受付コード を prefill する。
 *
 * Lark Base フォームの prefill 書式(公式): `?prefill_<項目名>=<値>&hide_<項目名>=1`。
 *  - <項目名> はフォームの質問名と完全一致必須。
 *  - 非表示にしたい項目はフォーム設計側では「表示」にしたまま URL の hide_ で隠す。
 *    ⚠ 設計側で非表示にすると prefill が効かないため、売約番号は hide_ で隠す。
 * 売約番号: 要件上「非表示/初期値」→ prefill + hide_ で自動付与かつ回答者に見せない。
 * 受付コード: 要件上は表示のまま初期値設定(SEC-04照合の正)→ prefill のみ。
 * 物件名: 作業員が現場を取り違えないよう、表示のまま prefill(hide しない)。フォームに
 *   「物件名」質問が存在する(visible)前提。※ 値に空白を含むと + 化され Lark で不整合の
 *   可能性があるため実機確認する。
 * 営業担当者名: 作業員が山口産業側の担当を把握できるよう、表示のまま prefill。
 *   ⚠ 当該フォームはフィールド名="営業担当者名" だが質問ラベル(title)="営業担当者" と不一致。
 *     prefill がどちらで照合されても当たるよう両名で送る(不一致側は Lark が無視)。
 *     記録先フィールドは"営業担当者名"なので F2-06 閲覧に影響なし。
 * prefill が効かない場合も F2-10 画面に受付コードを表示し手入力で投稿できる(フォールバック)。
 */
export function buildNippouFormUrl(
  seiban: string,
  code: string,
  opts: { bukken?: string; salesPerson?: string } = {}
): string {
  const params = new URLSearchParams();
  params.set("prefill_売約番号", seiban);
  params.set("hide_売約番号", "1");
  params.set("prefill_受付コード", code);
  if (opts.bukken) params.set("prefill_物件名", opts.bukken);
  if (opts.salesPerson) {
    params.set("prefill_営業担当者名", opts.salesPerson);
    params.set("prefill_営業担当者", opts.salesPerson);
  }
  return `${NIPPOU_FORM_SHARE_URL}?${params.toString()}`;
}

/**
 * 外注業者へ配布する案件別URL(F2-10ページ)。製番+受付コードから都度生成(テーブルには保存しない)。
 * QR表示(F2-08)・メール(F2-09)の配布導線に使う。origin は呼び出し側(リクエスト)から渡す。
 */
export function buildContractorPageUrl(origin: string, seiban: string, code: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/genba/${encodeURIComponent(seiban)}?code=${encodeURIComponent(code)}`;
}

/** Lark の Lookup/テキスト/選択等の値を文字列へ正規化(配列/オブジェクトを吸収) */
export function extractText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => extractText(v)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return String(o.text ?? o.name ?? o.value ?? o.en_name ?? "");
  }
  return String(value);
}

export interface NippouAttachment {
  file_token?: string;
  name?: string;
  type?: string;
  size?: number;
  url?: string;
  tmp_url?: string;
}

export interface NippouReport {
  record_id: string;
  seiban: string; // 売約番号
  bukken: string; // 物件名
  company: string; // 会社名
  reporter: string; // 報告者氏名
  reportDate: string; // 作業報告日
  workers: number | null; // 作業人数
  content: string; // 作業内容
  notes: string; // 特記事項・連絡事項
  tomorrow: string; // 翌日の作業予定
  photos: NippouAttachment[]; // 現場写真
  uketsukeCode: string; // 受付コード
  matchResult: string; // 受付コード照合結果(有効/無効)
  isValid: boolean; // 有効フラグ
  postedAt: string | number; // 投稿日時(作成日時)
}

export interface NippouAnken {
  record_id: string;
  seiban: string;
  bukken: string; // 物件名(Lookup)
  location: string; // 施工場所(Lookup=納入先住所)
  salesPerson: string; // 営業担当者名(Lookup=売約情報「担当者」)
  contractorEmail: string; // 業者メールアドレス
  chatId: string; // 現場chat_id(Lookup)
  uketsukeCode: string; // 受付コード
  status: string; // 状態(有効/完了)
  contractor: string; // 業者
}

/** 案件マスタから売約番号(製番)で1件取得 */
export async function getNippouAnken(seiban: string): Promise<NippouAnken | null> {
  if (!seiban) return null;
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU_ANKEN");
  const res = await getBaseRecords(tables.NIPPOU_ANKEN, {
    baseToken,
    filter: `CurrentValue.[売約番号] = "${escapeLarkFilterValue(seiban)}"`,
    pageSize: 1,
  });
  const item = res.data?.items?.[0] as { record_id: string; fields: Record<string, any> } | undefined;
  if (!item) return null;
  const f = item.fields;
  return {
    record_id: item.record_id,
    seiban: extractText(f["売約番号"]),
    bukken: extractText(f["物件名"]),
    location: extractText(f["施工場所"]),
    salesPerson: extractText(f["営業担当者名"]),
    contractorEmail: extractText(f["業者メールアドレス"]),
    chatId: extractText(f["現場chat_id"]),
    uketsukeCode: extractText(f["受付コード"]),
    status: extractText(f["状態"]),
    contractor: extractText(f["業者"]),
  };
}

/**
 * 現場作業日報を売約番号で取得(既定は有効投稿のみ)。作業報告日の新しい順。
 */
export async function getNippouReports(
  seiban: string,
  opts: { onlyValid?: boolean } = {}
): Promise<NippouReport[]> {
  if (!seiban) return [];
  const onlyValid = opts.onlyValid ?? true;
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU");
  const res = await getBaseRecords(tables.NIPPOU, {
    baseToken,
    filter: `CurrentValue.[売約番号] = "${escapeLarkFilterValue(seiban)}"`,
    pageSize: 200,
  });
  const items = (res.data?.items || []) as Array<{ record_id: string; fields: Record<string, any> }>;
  const reports: NippouReport[] = items.map((item) => {
    const f = item.fields;
    const workersRaw = f["作業人数"];
    return {
      record_id: item.record_id,
      seiban: extractText(f["売約番号"]),
      bukken: extractText(f["物件名"]),
      company: extractText(f["会社名"]),
      reporter: extractText(f["報告者氏名"]),
      reportDate: extractText(f["作業報告日"]),
      workers: typeof workersRaw === "number" ? workersRaw : workersRaw ? Number(workersRaw) : null,
      content: extractText(f["作業内容"]),
      notes: extractText(f["特記事項・連絡事項"]),
      tomorrow: extractText(f["翌日の作業予定"]),
      photos: Array.isArray(f["現場写真"]) ? (f["現場写真"] as NippouAttachment[]) : [],
      uketsukeCode: extractText(f["受付コード"]),
      matchResult: extractText(f["受付コード照合結果"]),
      isValid: f["有効フラグ"] === true || f["有効フラグ"] === 1,
      postedAt: (f["投稿日時"] as number) ?? "",
    };
  });
  const filtered = onlyValid ? reports.filter((r) => r.isValid) : reports;
  // 作業報告日の新しい順(空は末尾)
  filtered.sort((a, b) => (b.reportDate || "").localeCompare(a.reportDate || ""));
  return filtered;
}

/**
 * 案件マスタの「配布設定」を売約詳細から登録/更新(F2-07)。無ければ作成、有れば更新。
 * 書込むのは書込可能項目のみ(業者メールアドレス/受付コード/業者/状態)。
 * 物件名/施工場所/営業担当者名/現場chat_id は 売約情報からの Lookup のため書込まない。
 */
export async function upsertNippouAnken(
  seiban: string,
  input: {
    contractorEmail?: string;
    uketsukeCode?: string;
    contractor?: string;
    status?: string;
  }
): Promise<NippouAnken | null> {
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU_ANKEN");
  const existing = await getNippouAnken(seiban);

  const fields: Record<string, any> = { 売約番号: seiban };
  if (input.contractorEmail !== undefined) fields["業者メールアドレス"] = input.contractorEmail;
  if (input.uketsukeCode !== undefined) fields["受付コード"] = input.uketsukeCode;
  if (input.contractor !== undefined) fields["業者"] = input.contractor;
  if (input.status !== undefined) fields["状態"] = input.status; // 単一選択(既存の選択肢: 有効/完了)

  if (existing) {
    await updateBaseRecord(tables.NIPPOU_ANKEN, existing.record_id, fields, { baseToken });
  } else {
    await createBaseRecord(tables.NIPPOU_ANKEN, fields, { baseToken });
  }
  return getNippouAnken(seiban);
}
