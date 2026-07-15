/**
 * 現場作業日報システムの Lark テーブルを project base に新設する（冪等）。
 *
 *   npx tsx scripts/nippou/setup-tables.ts
 *
 * 作成対象（要件定義書 第2.3版 §6 データモデルに準拠）:
 *   - 現場作業日報            … フォーム投稿の蓄積先（F2-04）
 *   - 現場作業日報_案件マスタ … 売約番号・受付コード・chat_id・状態 等（F2-07）
 *
 * 既に同名テーブルがあれば作成せず table_id を表示する。
 * 出力された table_id を lib/lark-tables.ts のフォールバック / env に設定する。
 *
 * ⚠️ 作成先 project base（LARK_BASE_TOKEN）は本番main・全featブランチ共有。追加のみ（既存不変更）。
 * ⚠️ アプリにテーブル作成権限が無い場合は appTable.create が権限エラーになる。その場合は
 *    本スクリプトの FIELDS 定義を仕様として Lark UI で手動作成し、再実行で table_id を取得する。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN || "";

// Lark Bitable フィールド型: 1=テキスト 2=数値 3=単一選択 5=日付 7=チェックボックス 17=添付 1001=作成日時
type FieldDef = { name: string; type: number; property?: any };

const TABLES: { name: string; fields: FieldDef[] }[] = [
  {
    name: "現場作業日報",
    fields: [
      { name: "売約番号", type: 1 }, // プライマリ（先頭）
      { name: "物件名", type: 1 },
      { name: "会社名", type: 1 },
      { name: "報告者氏名", type: 1 },
      { name: "作業報告日", type: 5, property: { date_formatter: "yyyy/MM/dd" } },
      { name: "作業人数", type: 2 },
      { name: "作業内容", type: 1 },
      { name: "特記事項・連絡事項", type: 1 },
      { name: "翌日の作業予定", type: 1 },
      { name: "現場写真", type: 17 },
      { name: "受付コード", type: 1 },
      { name: "受付コード照合結果", type: 3, property: { options: [{ name: "有効" }, { name: "無効" }] } },
      { name: "有効フラグ", type: 7 },
      { name: "投稿日時", type: 1001 },
    ],
  },
  {
    name: "現場作業日報_案件マスタ",
    // ※ 実テーブル(tblH486vHdn7mixz)では 物件名/施工場所/営業担当者名/現場chat_id は
    //    売約情報(tbl1ICzfUixpGqDy, 製番)からの Lookup(type=19)。下記は型=1 のフォールバック表記。
    //    Lookup はこの簡易APIでは生成不可のため、UI で作成済み。既存名一致でスキップされる。
    fields: [
      { name: "売約番号", type: 1 }, // プライマリ（先頭）
      { name: "物件名", type: 1 }, // 実=Lookup(売約情報)
      { name: "施工場所", type: 1 }, // 実=Lookup(納入先住所)
      { name: "営業担当者名", type: 1 }, // 実=Lookup(売約情報「担当者」)。F2-06等で表示
      { name: "業者メールアドレス", type: 1 }, // F2-09 メール宛先(再利用)
      { name: "現場chat_id", type: 1 }, // 実=Lookup(現場チャットルーム)
      { name: "受付コード", type: 1 },
      { name: "案件別URL", type: 1 },
      { name: "状態", type: 3, property: { options: [{ name: "有効" }, { name: "完了" }] } },
      { name: "業者", type: 1 },
    ],
  },
];

function client() {
  return new lark.Client({
    appId: process.env.LARK_APP_ID || "cli_a9d79d0bbf389e1c",
    appSecret: process.env.LARK_APP_SECRET || "",
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });
}

async function findTable(c: lark.Client, name: string): Promise<string | null> {
  let pageToken: string | undefined;
  do {
    const r: any = await c.bitable.appTable.list({
      path: { app_token: BASE },
      params: { page_size: 100, page_token: pageToken },
    });
    if (r.code !== 0) throw new Error(`appTable.list 失敗: ${r.msg} (code=${r.code})`);
    for (const t of r.data?.items || []) if (t.name === name) return t.table_id;
    pageToken = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pageToken);
  return null;
}

async function ensureTable(c: lark.Client, def: { name: string; fields: FieldDef[] }): Promise<string> {
  const existing = await findTable(c, def.name);
  if (existing) {
    console.log(`✓ 既存テーブル「${def.name}」 table_id = ${existing}`);
    // 既存テーブルに不足フィールドを追加（冪等）
    const fr: any = await c.bitable.appTableField.list({
      path: { app_token: BASE, table_id: existing },
      params: { page_size: 200 },
    });
    const have = new Set<string>((fr.data?.items || []).map((f: any) => f.field_name));
    for (const f of def.fields) {
      if (have.has(f.name)) continue;
      const r: any = await c.bitable.appTableField.create({
        path: { app_token: BASE, table_id: existing },
        data: { field_name: f.name, type: f.type as any, property: f.property },
      });
      if (r.code !== 0) throw new Error(`フィールド作成失敗 (${def.name}.${f.name}): ${r.msg} (code=${r.code})`);
      console.log(`  + フィールド追加「${f.name}」(type=${f.type})`);
    }
    return existing;
  }

  console.log(`テーブル「${def.name}」を作成します...`);
  const created: any = await c.bitable.appTable.create({
    path: { app_token: BASE },
    data: {
      table: {
        name: def.name,
        default_view_name: "一覧",
        fields: [{ field_name: def.fields[0].name, type: def.fields[0].type }],
      },
    },
  });
  if (created.code !== 0) throw new Error(`appTable.create 失敗 (${def.name}): ${created.msg} (code=${created.code})`);
  const tableId = created.data?.table_id as string;
  console.log(`  作成 table_id = ${tableId}`);

  for (const f of def.fields.slice(1)) {
    const r: any = await c.bitable.appTableField.create({
      path: { app_token: BASE, table_id: tableId },
      data: { field_name: f.name, type: f.type as any, property: f.property },
    });
    if (r.code !== 0) throw new Error(`フィールド作成失敗 (${def.name}.${f.name}): ${r.msg} (code=${r.code})`);
    console.log(`  + フィールド「${f.name}」(type=${f.type})`);
  }
  return tableId;
}

async function main() {
  if (!BASE) throw new Error("LARK_BASE_TOKEN 未設定");
  const c = client();
  const ids: Record<string, string> = {};
  for (const def of TABLES) ids[def.name] = await ensureTable(c, def);

  console.log("\n✅ 完了。lib/lark-tables.ts / env に設定する table_id:");
  console.log(`   LARK_TABLE_NIPPOU            = ${ids["現場作業日報"]}`);
  console.log(`   LARK_TABLE_NIPPOU_ANKEN      = ${ids["現場作業日報_案件マスタ"]}`);
}

main().catch((e) => {
  console.error("[fatal]", e?.response?.data || e?.message || e);
  process.exit(1);
});
