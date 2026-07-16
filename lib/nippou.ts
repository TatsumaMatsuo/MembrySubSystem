// 現場作業日報システム データ層(F2-06 社内閲覧 / F2-07 案件別URL)
//
// - 現場作業日報(NIPPOU): フォーム投稿の蓄積先。売約番号で該当案件の有効日報を取得。
// - 現場作業日報_案件マスタ(NIPPOU_ANKEN): 案件別の配布情報。物件名/施工場所/営業担当者名/
//   現場chat_id は 売約情報(製番)からの Lookup(配列オブジェクト)なので値抽出する。
import { getBaseRecords, createBaseRecord, updateBaseRecord, getLarkClient } from "./lark-client";
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
  reportDate: string; // 作業報告日(表示用 YYYY/MM/DD)
  reportDateTs: number; // 作業報告日(ソート用タイムスタンプ)
  workers: number | null; // 作業人数
  content: string; // 作業内容
  notes: string; // 特記事項・連絡事項
  tomorrow: string; // 翌日の作業予定
  photos: NippouAttachment[]; // 現場写真
  uketsukeCode: string; // 受付コード(業者グルーピングのキー)
  postedAt: string | number; // 投稿日時(作成日時)
}

/** 作業報告日(日付フィールド=UTC0時のタイムスタンプ)を YYYY/MM/DD 表示とソート用tsに整形 */
function formatReportDate(v: unknown): { text: string; ts: number } {
  if (typeof v === "number" && v > 0) {
    const d = new Date(v);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return { text: `${y}/${m}/${day}`, ts: v };
  }
  return { text: extractText(v), ts: 0 };
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

/** 案件マスタのレコード1件を NippouAnken へ整形 */
function mapAnken(item: { record_id: string; fields: Record<string, any> }): NippouAnken {
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

/** 案件マスタから売約番号(製番)で1件取得(後方互換。複数業者時は先頭) */
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
  return item ? mapAnken(item) : null;
}

/** 案件マスタから売約番号(製番)で全業者行を取得(1製番=複数施工業者) */
export async function getNippouAnkenList(seiban: string): Promise<NippouAnken[]> {
  if (!seiban) return [];
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU_ANKEN");
  const res = await getBaseRecords(tables.NIPPOU_ANKEN, {
    baseToken,
    filter: `CurrentValue.[売約番号] = "${escapeLarkFilterValue(seiban)}"`,
    pageSize: 200,
  });
  const items = (res.data?.items || []) as Array<{ record_id: string; fields: Record<string, any> }>;
  return items.map(mapAnken);
}

/** 受付コードで案件マスタの業者行を1件取得(/genba・メールの業者解決) */
export async function getNippouAnkenByCode(code: string): Promise<NippouAnken | null> {
  if (!code) return null;
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU_ANKEN");
  const res = await getBaseRecords(tables.NIPPOU_ANKEN, {
    baseToken,
    filter: `CurrentValue.[受付コード] = "${escapeLarkFilterValue(code)}"`,
    pageSize: 1,
  });
  const item = res.data?.items?.[0] as { record_id: string; fields: Record<string, any> } | undefined;
  return item ? mapAnken(item) : null;
}

/**
 * 現場作業日報を売約番号で取得。作業報告日の昇順(古い順)。
 * ※ 受付コード照合結果/有効フラグは廃止したため、全投稿を返す(除外なし)。
 */
export async function getNippouReports(seiban: string): Promise<NippouReport[]> {
  if (!seiban) return [];
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
    const d = formatReportDate(f["作業報告日"]);
    return {
      record_id: item.record_id,
      seiban: extractText(f["売約番号"]),
      bukken: extractText(f["物件名"]),
      company: extractText(f["会社名"]),
      reporter: extractText(f["報告者氏名"]),
      reportDate: d.text,
      reportDateTs: d.ts,
      workers: typeof workersRaw === "number" ? workersRaw : workersRaw ? Number(workersRaw) : null,
      content: extractText(f["作業内容"]),
      notes: extractText(f["特記事項・連絡事項"]),
      tomorrow: extractText(f["翌日の作業予定"]),
      photos: Array.isArray(f["現場写真"]) ? (f["現場写真"] as NippouAttachment[]) : [],
      uketsukeCode: extractText(f["受付コード"]),
      postedAt: (f["投稿日時"] as number) ?? "",
    };
  });
  // 作業報告日の昇順(古い順)。ts優先、無ければ表示文字列で比較。
  reports.sort((a, b) => a.reportDateTs - b.reportDateTs || a.reportDate.localeCompare(b.reportDate));
  return reports;
}

/**
 * 売約情報(製番)から 物件名(受注件名)/施工場所(納入先住所)/営業担当者名(担当者) を直接取得。
 * 案件マスタの同名はこれらの filter型Lookup(売約番号突合)で、レコード作成直後は未計算のことがある。
 * メール本文・/genba 表示・フォーム prefill の空欄防止に、売約情報から直に引くために使う。
 */
export async function getBaiyakuInfoForNippou(
  seiban: string
): Promise<{ bukken: string; location: string; salesPerson: string } | null> {
  if (!seiban) return null;
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("BAIYAKU");
  const res = await getBaseRecords(tables.BAIYAKU, {
    baseToken,
    filter: `CurrentValue.[製番] = "${escapeLarkFilterValue(seiban)}"`,
    pageSize: 1,
  });
  const item = res.data?.items?.[0] as { fields: Record<string, any> } | undefined;
  if (!item) return null;
  const f = item.fields;
  return {
    bukken: extractText(f["受注件名"]),
    location: extractText(f["納入先住所"]),
    salesPerson: extractText(f["担当者"]),
  };
}

/**
 * 案件マスタに施工業者行を新規作成(F2-07)。受付コードはサーバで自動生成。
 * 書込むのは書込可能項目のみ(業者メールアドレス/業者/受付コード/状態)。
 * 物件名/施工場所/営業担当者名/現場chat_id は売約情報からの Lookup(売約番号突合)のため書込まない。
 */
export async function createNippouAnken(
  seiban: string,
  input: { contractorEmail?: string; contractor?: string }
): Promise<NippouAnken | null> {
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU_ANKEN");
  const uketsukeCode = generateUketsukeCode();
  const fields: Record<string, any> = {
    売約番号: seiban,
    受付コード: uketsukeCode,
    状態: "有効", // 単一選択(既存の選択肢: 有効/完了)
  };
  if (input.contractorEmail !== undefined) fields["業者メールアドレス"] = input.contractorEmail;
  if (input.contractor !== undefined) fields["業者"] = input.contractor;
  await createBaseRecord(tables.NIPPOU_ANKEN, fields, { baseToken });
  // 受付コードは一意なので、作成直後の再取得に利用(Lookupは計算後に埋まる)
  return getNippouAnkenByCode(uketsukeCode);
}

/** 案件マスタの業者行を record_id 指定で更新(受付コード/状態は変えない) */
export async function updateNippouAnken(
  recordId: string,
  seiban: string,
  input: { contractorEmail?: string; contractor?: string }
): Promise<NippouAnken | null> {
  const tables = getLarkTables();
  const baseToken = getBaseTokenForTable("NIPPOU_ANKEN");
  const fields: Record<string, any> = {};
  if (input.contractorEmail !== undefined) fields["業者メールアドレス"] = input.contractorEmail;
  if (input.contractor !== undefined) fields["業者"] = input.contractor;
  await updateBaseRecord(tables.NIPPOU_ANKEN, recordId, fields, { baseToken });
  const list = await getNippouAnkenList(seiban);
  return list.find((a) => a.record_id === recordId) ?? null;
}

/**
 * 外注業者へ案件別URLを Lark Mail で送信(F2-09)。宛先=業者メールアドレス。
 * 前提(情シス設定): アプリに `mail:user_mailbox.message:send` スコープ、
 * 送信元メールボックスを env `NIPPOU_MAIL_SENDER` に設定。
 * @returns 送信可否。呼び出し側で保存成否と分離して扱う。
 */
export async function sendContractorMail(
  anken: NippouAnken,
  origin: string
): Promise<{ sent: boolean; to?: string; error?: string }> {
  const sender = process.env.NIPPOU_MAIL_SENDER;
  if (!sender) return { sent: false, error: "送信元メールボックス(NIPPOU_MAIL_SENDER)が未設定です。管理者にご連絡ください。" };
  if (!anken.contractorEmail) return { sent: false, error: "業者メールアドレスが未登録です。" };
  if (!anken.uketsukeCode) return { sent: false, error: "受付コードが未登録です。" };
  if (anken.status === "完了") return { sent: false, error: "完了案件のため送信できません。" };
  const base = (origin || "").replace(/\/$/, "");
  if (!base) return { sent: false, error: "アプリURL(NEXTAUTH_URL)が未設定です。" };

  // 案件マスタのLookup(物件名/施工場所)は作成直後に未計算のことがあるため、
  // 空なら売約情報から直接取得してフォールバック(メール本文の空欄防止)。
  let bukken = anken.bukken;
  let location = anken.location;
  if (!bukken || !location) {
    const info = await getBaiyakuInfoForNippou(anken.seiban);
    if (info) {
      bukken = bukken || info.bukken;
      location = location || info.location;
    }
  }

  const url = buildContractorPageUrl(base, anken.seiban, anken.uketsukeCode);
  const subject = `【現場作業日報】${bukken || anken.seiban} 日報投稿のご案内`;
  const bodyHtml =
    `<p>${anken.contractor || "ご担当者"} 様</p>` +
    `<p>いつもお世話になっております。<br>下記案件の作業日報を、以下の専用ページからご投稿ください。</p>` +
    `<p>■ 物件名: ${bukken || "-"}<br>■ 施工場所: ${location || "-"}</p>` +
    `<p><a href="${url}">${url}</a></p>` +
    `<p>※このURLは本案件専用です。SNS等での転送はお控えください。<br>` +
    `※フォームで受付コードを求められた場合は「${anken.uketsukeCode}」をご入力ください。</p>`;
  const bodyText =
    `${anken.contractor || "ご担当者"} 様\n\n` +
    `いつもお世話になっております。下記案件の作業日報を、以下の専用ページからご投稿ください。\n\n` +
    `物件名: ${bukken || "-"}\n施工場所: ${location || "-"}\n\n${url}\n\n` +
    `※このURLは本案件専用です。SNS等での転送はお控えください。\n` +
    `※フォームで受付コードを求められた場合は「${anken.uketsukeCode}」をご入力ください。`;

  const client = getLarkClient();
  if (!client) return { sent: false, error: "メール送信クライアントを初期化できません。" };
  const res: any = await client.mail.userMailboxMessage.send({
    path: { user_mailbox_id: sender },
    data: {
      subject,
      to: [{ mail_address: anken.contractorEmail, name: anken.contractor || undefined }],
      body_html: bodyHtml,
      body_plain_text: bodyText,
    },
  });
  if (res.code !== 0) {
    console.error("[nippou] sendContractorMail error:", res.code, res.msg);
    return { sent: false, error: `メール送信に失敗しました(${res.msg || res.code})。スコープ/送信元設定をご確認ください。` };
  }
  return { sent: true, to: anken.contractorEmail };
}
