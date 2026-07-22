/**
 * 棚卸入力Webアプリ Phase 0: 手動作成したテーブルの定義を検証する
 *   npx tsx scripts/verify-tanaoroshi-tables.ts
 *
 * docs/tanaoroshi/table-spec.md の定義どおりに作られているかを、
 * テーブル名で解決して フィールド名・型・単一選択の選択肢まで突合する。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN!;
const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

const T = { TEXT: 1, NUMBER: 2, SINGLE_SELECT: 3, DATETIME: 5, CHECKBOX: 7, ATTACHMENT: 17 } as const;
const TYPE_NAME: Record<number, string> = {
  1: "テキスト",
  2: "数値",
  3: "単一選択",
  5: "日付",
  7: "チェックボックス",
  17: "添付ファイル",
};

type Spec = { name: string; envKey: string; fields: { name: string; type: number; options?: string[] }[] };

const SPECS: Spec[] = [
  {
    name: "棚卸_期",
    envKey: "TANAOROSHI_PERIOD",
    fields: [
      { name: "期ID", type: T.TEXT },
      { name: "棚卸名称", type: T.TEXT },
      { name: "基準締日", type: T.DATETIME },
      { name: "状態", type: T.SINGLE_SELECT, options: ["準備中", "実施中", "締め"] },
      { name: "作成者", type: T.TEXT },
      { name: "作成日時", type: T.DATETIME },
      { name: "更新日時", type: T.DATETIME },
    ],
  },
  {
    name: "棚卸_倉庫進捗",
    envKey: "TANAOROSHI_WH_STATUS",
    fields: [
      { name: "進捗ID", type: T.TEXT },
      { name: "期ID", type: T.TEXT },
      { name: "倉庫コード", type: T.TEXT },
      { name: "倉庫名", type: T.TEXT },
      { name: "現在回数", type: T.NUMBER },
      {
        name: "ステータス",
        type: T.SINGLE_SELECT,
        options: ["未着手", "実施中", "発行処理中", "1回目確定", "2回目実施中", "2回目確定", "3回目実施中", "締め"],
      },
      { name: "対象品目数", type: T.NUMBER },
      { name: "報告済品目数", type: T.NUMBER },
      { name: "差分件数", type: T.NUMBER },
      { name: "最終報告日時", type: T.DATETIME },
      { name: "更新日時", type: T.DATETIME },
    ],
  },
  {
    name: "棚卸_実績",
    envKey: "TANAOROSHI_ENTRY",
    fields: [
      { name: "実績ID", type: T.TEXT },
      { name: "期ID", type: T.TEXT },
      { name: "倉庫コード", type: T.TEXT },
      { name: "倉庫名", type: T.TEXT },
      { name: "品番", type: T.TEXT },
      { name: "品名", type: T.TEXT },
      { name: "入力数量", type: T.NUMBER },
      { name: "在庫状態", type: T.SINGLE_SELECT, options: ["良品", "不良品", "滞留"] },
      { name: "写真", type: T.ATTACHMENT },
      { name: "入力方式", type: T.SINGLE_SELECT, options: ["読取", "手入力", "検索"] },
      { name: "棚卸回数", type: T.NUMBER },
      { name: "差分理由コード", type: T.TEXT },
      { name: "状態", type: T.SINGLE_SELECT, options: ["有効", "取消"] },
      { name: "取消元実績ID", type: T.TEXT },
      { name: "システム在庫なし", type: T.CHECKBOX },
      { name: "入力者", type: T.TEXT },
      { name: "入力者メール", type: T.TEXT },
      { name: "入力日時", type: T.DATETIME },
      { name: "送信日時", type: T.DATETIME },
      { name: "端末ID", type: T.TEXT },
    ],
  },
  {
    name: "棚卸_差分リスト",
    envKey: "TANAOROSHI_DIFF",
    fields: [
      { name: "差分ID", type: T.TEXT },
      { name: "期ID", type: T.TEXT },
      { name: "倉庫コード", type: T.TEXT },
      { name: "倉庫名", type: T.TEXT },
      { name: "品番", type: T.TEXT },
      { name: "品名", type: T.TEXT },
      { name: "システム在庫数", type: T.NUMBER },
      { name: "実棚数量", type: T.NUMBER },
      { name: "差分数", type: T.NUMBER },
      { name: "在庫状態内訳", type: T.TEXT },
      { name: "棚卸回数", type: T.NUMBER },
      { name: "差分理由コード", type: T.TEXT },
      { name: "差分理由名称", type: T.TEXT },
      { name: "解消フラグ", type: T.CHECKBOX },
      { name: "発行者", type: T.TEXT },
      { name: "発行日時", type: T.DATETIME },
    ],
  },
  {
    name: "棚卸_差分理由コードマスタ",
    envKey: "TANAOROSHI_REASON",
    fields: [
      { name: "理由コード", type: T.TEXT },
      { name: "理由名称", type: T.TEXT },
      { name: "表示順", type: T.NUMBER },
      { name: "有効フラグ", type: T.CHECKBOX },
    ],
  },
  {
    name: "棚卸_操作履歴",
    envKey: "TANAOROSHI_AUDIT",
    fields: [
      { name: "履歴ID", type: T.TEXT },
      { name: "期ID", type: T.TEXT },
      { name: "対象キー", type: T.TEXT },
      {
        name: "操作種別",
        type: T.SINGLE_SELECT,
        options: ["取消", "修正", "差分リスト発行", "締め", "基幹出力", "在庫取込", "初期化"],
      },
      { name: "変更前", type: T.TEXT },
      { name: "変更後", type: T.TEXT },
      { name: "備考", type: T.TEXT },
      { name: "操作者", type: T.TEXT },
      { name: "操作日時", type: T.DATETIME },
    ],
  },
];

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
  const tables = await listTables();
  const byName = new Map(tables.map((t) => [String(t.name), String(t.table_id)]));
  const byId = new Set(tables.map((t) => String(t.table_id)));

  let ng = 0;
  const envLines: string[] = [];

  for (const spec of SPECS) {
    // env(LARK_TABLE_TANAOROSHI_*) にIDがあればそれを優先。無ければ名前で解決。
    const envId = (process.env[`LARK_TABLE_${spec.envKey}`] || "").trim();
    const tableId = envId || byName.get(spec.name);
    console.log(`\n========== ${spec.name} ==========`);
    if (!tableId) {
      console.log(`  ❌ テーブルが見つかりません（名前一致なし・env未設定）`);
      ng++;
      continue;
    }
    if (!byId.has(tableId)) {
      console.log(`  ❌ 指定IDがこのBaseに存在しません: ${tableId}`);
      ng++;
      continue;
    }
    const realName = [...byName.entries()].find(([, id]) => id === tableId)?.[0];
    console.log(`  table_id: ${tableId}${envId ? " (env指定)" : ""}${realName && realName !== spec.name ? `  ⚠ 実テーブル名="${realName}"` : ""}`);
    envLines.push(`LARK_TABLE_${spec.envKey}=${tableId}`);

    const actual = await listFields(tableId);
    const map = new Map(actual.map((a) => [String(a.field_name), a]));

    for (const want of spec.fields) {
      const got = map.get(want.name);
      if (!got) {
        console.log(`  ❌ フィールドが無い: "${want.name}" (${TYPE_NAME[want.type]})`);
        ng++;
        continue;
      }
      if (Number(got.type) !== want.type) {
        console.log(
          `  ❌ 型が違う: "${want.name}" 期待=${TYPE_NAME[want.type]} 実際=${TYPE_NAME[Number(got.type)] || got.type}`
        );
        ng++;
        continue;
      }
      if (want.options) {
        const actualOpts = (got.property?.options || []).map((o: any) => String(o.name));
        const missing = want.options.filter((o) => !actualOpts.includes(o));
        const extra = actualOpts.filter((o: string) => !want.options!.includes(o));
        if (missing.length) {
          console.log(`  ❌ 選択肢が不足: "${want.name}" → ${missing.join(", ")}`);
          ng++;
          continue;
        }
        if (extra.length) console.log(`  ⚠ 余分な選択肢: "${want.name}" → ${extra.join(", ")}`);
      }
      console.log(`  ✅ ${want.name}`);
    }

    const spare = actual.filter((a) => !spec.fields.some((w) => w.name === String(a.field_name)));
    if (spare.length) console.log(`  ⚠ 定義に無いフィールド: ${spare.map((s) => `"${s.field_name}"`).join(", ")}`);
  }

  console.log(`\n\n===== .env に設定する値 =====`);
  envLines.forEach((l) => console.log(l));

  console.log(`\n${ng === 0 ? "✅ すべて定義どおりです" : `❌ ${ng}件の不一致があります`}`);
  if (ng > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e?.response?.data || e);
  process.exit(1);
});
