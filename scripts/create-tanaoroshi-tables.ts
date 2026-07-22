/**
 * 棚卸入力Webアプリ Phase 0: Lark Base テーブル作成
 *
 *   npx tsx scripts/create-tanaoroshi-tables.ts --dry-run   # 作成予定を表示のみ
 *   npx tsx scripts/create-tanaoroshi-tables.ts             # 実行
 *
 * 冪等: 既に同名テーブルがあればスキップし、不足フィールドのみ追加する。
 * 単一選択の選択肢は作成時に property.options で指定する（既存フィールドへの
 * 選択肢追加は API 不可のため、ここで作り切ることが重要）。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const DRY = process.argv.includes("--dry-run");
const BASE = process.env.LARK_BASE_TOKEN!;

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

/** Lark Bitable フィールド型 */
const T = {
  TEXT: 1,
  NUMBER: 2,
  SINGLE_SELECT: 3,
  DATETIME: 5,
  CHECKBOX: 7,
  ATTACHMENT: 17,
} as const;

type FieldDef = {
  name: string;
  type: number;
  options?: string[];
  /** 数値の書式。整数は "0" */
  formatter?: string;
};

const f = (name: string, type: number, extra: Partial<FieldDef> = {}): FieldDef => ({ name, type, ...extra });

/**
 * テーブル定義
 * 先頭フィールドが主キー列（Lark の仕様上テキスト型が扱いやすい）。
 */
const TABLES: { name: string; fields: FieldDef[] }[] = [
  {
    name: "棚卸_期",
    fields: [
      f("期ID", T.TEXT),
      f("棚卸名称", T.TEXT),
      f("基準締日", T.DATETIME),
      f("状態", T.SINGLE_SELECT, { options: ["準備中", "実施中", "締め"] }),
      f("作成者", T.TEXT),
      f("作成日時", T.DATETIME),
      f("更新日時", T.DATETIME),
    ],
  },
  {
    name: "棚卸_倉庫進捗",
    fields: [
      f("進捗ID", T.TEXT), // 期ID|倉庫コード
      f("期ID", T.TEXT),
      f("倉庫コード", T.TEXT),
      f("倉庫名", T.TEXT),
      f("現在回数", T.NUMBER, { formatter: "0" }),
      f("ステータス", T.SINGLE_SELECT, {
        options: [
          "未着手",
          "実施中",
          "発行処理中",
          "1回目確定",
          "2回目実施中",
          "2回目確定",
          "3回目実施中",
          "締め",
        ],
      }),
      f("対象品目数", T.NUMBER, { formatter: "0" }),
      f("報告済品目数", T.NUMBER, { formatter: "0" }),
      f("差分件数", T.NUMBER, { formatter: "0" }),
      f("最終報告日時", T.DATETIME),
      f("更新日時", T.DATETIME),
    ],
  },
  {
    name: "棚卸_実績",
    fields: [
      f("実績ID", T.TEXT), // クライアント採番UUID（冪等キー）
      f("期ID", T.TEXT),
      f("倉庫コード", T.TEXT),
      f("倉庫名", T.TEXT),
      f("品番", T.TEXT),
      f("品名", T.TEXT),
      f("入力数量", T.NUMBER, { formatter: "0" }),
      f("在庫状態", T.SINGLE_SELECT, { options: ["良品", "不良品", "滞留"] }),
      f("写真", T.ATTACHMENT),
      f("入力方式", T.SINGLE_SELECT, { options: ["読取", "手入力", "検索"] }),
      f("棚卸回数", T.NUMBER, { formatter: "0" }),
      f("差分理由コード", T.TEXT),
      f("状態", T.SINGLE_SELECT, { options: ["有効", "取消"] }),
      f("取消元実績ID", T.TEXT),
      f("システム在庫なし", T.CHECKBOX),
      f("入力者", T.TEXT),
      f("入力者メール", T.TEXT),
      f("入力日時", T.DATETIME),
      f("送信日時", T.DATETIME),
      f("端末ID", T.TEXT),
    ],
  },
  {
    name: "棚卸_差分リスト",
    fields: [
      f("差分ID", T.TEXT), // 期ID|倉庫コード|品番|回数
      f("期ID", T.TEXT),
      f("倉庫コード", T.TEXT),
      f("倉庫名", T.TEXT),
      f("品番", T.TEXT),
      f("品名", T.TEXT),
      f("システム在庫数", T.NUMBER, { formatter: "0" }),
      f("実棚数量", T.NUMBER, { formatter: "0" }),
      f("差分数", T.NUMBER, { formatter: "0" }),
      f("在庫状態内訳", T.TEXT),
      f("棚卸回数", T.NUMBER, { formatter: "0" }),
      f("差分理由コード", T.TEXT),
      f("差分理由名称", T.TEXT),
      f("解消フラグ", T.CHECKBOX),
      f("発行者", T.TEXT),
      f("発行日時", T.DATETIME),
    ],
  },
  {
    name: "棚卸_差分理由コードマスタ",
    fields: [
      f("理由コード", T.TEXT),
      f("理由名称", T.TEXT),
      f("表示順", T.NUMBER, { formatter: "0" }),
      f("有効フラグ", T.CHECKBOX),
    ],
  },
  {
    name: "棚卸_操作履歴",
    fields: [
      f("履歴ID", T.TEXT),
      f("期ID", T.TEXT),
      f("対象キー", T.TEXT),
      f("操作種別", T.SINGLE_SELECT, {
        options: ["取消", "修正", "差分リスト発行", "締め", "基幹出力", "在庫取込", "初期化"],
      }),
      f("変更前", T.TEXT),
      f("変更後", T.TEXT),
      f("備考", T.TEXT),
      f("操作者", T.TEXT),
      f("操作日時", T.DATETIME),
    ],
  },
];

/** 差分理由コードマスタの初期値 */
const REASON_SEED = [
  { code: "R01", name: "出荷未計上" },
  { code: "R02", name: "入庫未計上" },
  { code: "R03", name: "破損" },
  { code: "R04", name: "紛失" },
  { code: "R05", name: "数え間違い" },
  { code: "R99", name: "その他" },
];

function fieldPayload(d: FieldDef) {
  const p: any = { field_name: d.name, type: d.type };
  if (d.type === T.SINGLE_SELECT && d.options) {
    p.property = { options: d.options.map((name) => ({ name })) };
  }
  if (d.type === T.NUMBER && d.formatter) {
    p.property = { formatter: d.formatter };
  }
  if (d.type === T.DATETIME) {
    p.property = { date_formatter: "yyyy/MM/dd HH:mm", auto_fill: false };
  }
  return p;
}

async function listTables() {
  const items: any[] = [];
  let token: string | undefined;
  do {
    const r: any = await client.bitable.appTable.list({
      path: { app_token: BASE },
      params: { page_size: 100, page_token: token },
    });
    items.push(...(r.data?.items || []));
    token = r.data?.has_more ? r.data?.page_token : undefined;
  } while (token);
  return items;
}

async function listFields(tableId: string) {
  const items: any[] = [];
  let token: string | undefined;
  do {
    const r: any = await client.bitable.appTableField.list({
      path: { app_token: BASE, table_id: tableId },
      params: { page_size: 100, page_token: token },
    });
    items.push(...(r.data?.items || []));
    token = r.data?.has_more ? r.data?.page_token : undefined;
  } while (token);
  return items;
}

async function main() {
  if (!BASE) throw new Error("LARK_BASE_TOKEN が未設定です");
  console.log(`Base: ${BASE.slice(0, 12)}...  ${DRY ? "[DRY RUN]" : "[EXECUTE]"}\n`);

  const existing = await listTables();
  const byName = new Map(existing.map((t) => [String(t.name), String(t.table_id)]));
  const created: Record<string, string> = {};

  for (const def of TABLES) {
    let tableId = byName.get(def.name);

    if (!tableId) {
      console.log(`■ 新規作成: "${def.name}" (${def.fields.length}列)`);
      if (DRY) {
        def.fields.forEach((d) => console.log(`     + ${d.name} (type=${d.type})${d.options ? ` [${d.options.join("/")}]` : ""}`));
        continue;
      }
      // 先頭フィールドだけを持つテーブルを作り、残りは追加していく
      const r: any = await client.bitable.appTable.create({
        path: { app_token: BASE },
        data: { table: { name: def.name, fields: [fieldPayload(def.fields[0])] } },
      });
      tableId = String(r.data?.table_id);
      console.log(`   → 作成 ${tableId}`);
    } else {
      console.log(`■ 既存: "${def.name}" (${tableId})`);
    }
    created[def.name] = tableId!;

    if (DRY) continue;

    // 不足フィールドを追加
    const now = await listFields(tableId!);
    const have = new Set(now.map((x) => String(x.field_name)));
    for (const d of def.fields) {
      if (have.has(d.name)) continue;
      try {
        await client.bitable.appTableField.create({
          path: { app_token: BASE, table_id: tableId! },
          data: fieldPayload(d) as any,
        });
        console.log(`     + ${d.name}`);
      } catch (e: any) {
        console.log(`     ! ${d.name} 失敗: ${e?.response?.data?.msg || e?.message || e}`);
      }
    }
  }

  // 差分理由コードマスタの初期投入
  const reasonTable = created["棚卸_差分理由コードマスタ"];
  if (reasonTable && !DRY) {
    const cur: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE, table_id: reasonTable },
      params: { page_size: 100 },
    });
    if (!(cur.data?.items || []).length) {
      await client.bitable.appTableRecord.batchCreate({
        path: { app_token: BASE, table_id: reasonTable },
        data: {
          records: REASON_SEED.map((r, i) => ({
            fields: { 理由コード: r.code, 理由名称: r.name, 表示順: i + 1, 有効フラグ: true },
          })),
        },
      });
      console.log(`\n■ 差分理由コードマスタ 初期値 ${REASON_SEED.length}件を投入`);
    } else {
      console.log(`\n■ 差分理由コードマスタ 既にデータあり。投入スキップ`);
    }
  }

  console.log(`\n===== lib/lark-tables.ts 用のテーブルID =====`);
  const KEY: Record<string, string> = {
    棚卸_期: "TANAOROSHI_PERIOD",
    棚卸_倉庫進捗: "TANAOROSHI_WH_STATUS",
    棚卸_実績: "TANAOROSHI_ENTRY",
    棚卸_差分リスト: "TANAOROSHI_DIFF",
    棚卸_差分理由コードマスタ: "TANAOROSHI_REASON",
    棚卸_操作履歴: "TANAOROSHI_AUDIT",
  };
  for (const [jp, key] of Object.entries(KEY)) {
    if (created[jp]) console.log(`    ${key}: process.env.LARK_TABLE_${key} || "${created[jp]}",`);
  }
}

main().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
