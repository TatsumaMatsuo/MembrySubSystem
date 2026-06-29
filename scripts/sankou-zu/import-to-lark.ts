/**
 * 参考図台帳検索 — Access(参考図.accdb)エクスポートJSON を Lark Bitable へ投入するスクリプト
 *
 * 設計: docs/eigyo-sankou-zu/README.md §6 / lark-table-spec.md
 *
 * 前提:
 *  - Lark UI で「参考図面台帳」「参考図面部品マスタ」を手動作成済みであること(アプリにテーブル
 *    新規作成権限が無い既知制約)。作成後に lib/lark-tables.ts の SANKOU_DAICHO / SANKOU_BUHIN
 *    にテーブルID(tbl…)を設定するか、環境変数 LARK_TABLE_SANKOU_DAICHO / LARK_TABLE_SANKOU_BUHIN
 *    で渡すこと。
 *  - 配置 base は project(基準風速検索と同じ)。lib/lark-client.ts の getLarkBaseToken() を使用。
 *
 * 突合(冪等):
 *  - 台帳   = 伝票番号(SANKOU_DAICHO_KEY) / 部品マスタ = ID(SANKOU_BUHIN_KEY)
 *  - 既存にキー一致 → 差分があれば update / 無ければ skip。未存在 → create。
 *  - source が null/空 のフィールドは送らない(既存値の空上書き防止)。
 *  - 数値型(*_NUMERIC_FIELDS)は Number、その他は String に正規化(柱成/梁成等の数値→テキスト化を含む)。
 *
 * 実行:
 *   既定は dry-run(件数のみ表示、書き込みなし)。実投入は --execute。
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sankou-zu/import-to-lark.ts
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/sankou-zu/import-to-lark.ts --execute
 *   ...                                                                       --only=daicho   # 台帳のみ
 *   ...                                                                       --only=buhin    # 部品マスタのみ
 *   ...                                                          --purge --only=buhin --execute # 対象テーブルの全行削除(再投入前のクリア用)
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config(); // .env もフォールバックで読む

import {
  getLarkBaseToken,
  getBaseRecords,
  batchCreateBaseRecords,
  batchUpdateBaseRecords,
  batchDeleteBaseRecords,
  getTableFields,
} from "../../lib/lark-client";
import {
  getLarkTables,
  SANKOU_DAICHO_FIELDS,
  SANKOU_DAICHO_NUMERIC_FIELDS,
  SANKOU_DAICHO_KEY,
  SANKOU_BUHIN_FIELDS,
  SANKOU_BUHIN_KEY,
} from "../../lib/lark-tables";

const DATA_DIR = path.join(__dirname, "data");

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const PURGE = args.includes("--purge");
const ONLY = (args.find((a) => a.startsWith("--only="))?.split("=")[1] || "").toLowerCase();

type Row = Record<string, unknown>;

interface TablePlan {
  label: string;
  tableId: string;
  jsonFile: string;
  fields: readonly string[];
  numericFields: ReadonlySet<string>;
  key: string;
}

/** source 値を Lark 投入用に正規化。送らない場合は undefined を返す。 */
function normalize(value: unknown, isNumeric: boolean): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  if (isNumeric) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return typeof value === "string" ? value : String(value);
}

/** 既存レコードの値を比較用文字列へ。Lark のテキストは稀に segment 配列で返るため吸収。 */
function existingToCompare(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => (v && typeof v === "object" && "text" in (v as any) ? (v as any).text : String(v)))
      .join("");
  }
  if (typeof value === "object" && "text" in (value as any)) return String((value as any).text);
  return String(value);
}

/** 台帳/部品マスタ1テーブル分を取得→突合→(必要なら)投入。 */
async function importTable(plan: TablePlan) {
  console.log(`\n===== ${plan.label} =====`);
  if (!plan.tableId) {
    console.error(
      `[skip] テーブルID未設定。lib/lark-tables.ts または環境変数で ${plan.label} のテーブルID(tbl…)を設定してください。`
    );
    return;
  }

  // 0) --purge: 対象テーブルの全行削除(再投入前のクリア)。--execute 併用時のみ実削除。
  if (PURGE) {
    const baseToken = getLarkBaseToken();
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const res = await getBaseRecords(plan.tableId, { pageSize: 500, pageToken, baseToken });
      for (const it of res.data?.items ?? []) ids.push(it.record_id as string);
      pageToken = res.data?.has_more ? res.data?.page_token : undefined;
    } while (pageToken);
    console.log(`purge対象: ${ids.length} 件`);
    if (!EXECUTE) {
      console.log("[dry-run] 削除は行いません。--execute を付けると全削除します。");
    } else if (ids.length > 0) {
      await batchDeleteBaseRecords(plan.tableId, ids, { baseToken });
      console.log("全削除 完了。");
    }
    return; // purge は投入と同時実行しない(削除のみ)。投入は再実行で。
  }

  // 1) source 読み込み
  const filePath = path.join(DATA_DIR, plan.jsonFile);
  if (!fs.existsSync(filePath)) {
    console.error(`[skip] エクスポートJSONが見つかりません: ${filePath}`);
    return;
  }
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Row[];
  console.log(`source: ${rows.length} 件 (${plan.jsonFile})`);

  const baseToken = getLarkBaseToken();

  // 1.5) 事前チェック: Lark テーブルに必要フィールドが存在するか(1つでも欠けると batchCreate が
  //      全件失敗するため、ここで止めて欠落フィールドを明示する。フィールドは UI 手動作成が必須)。
  //      併せて実フィールド型(1=テキスト, 2=数値…)を取得し、値の型変換は静的定義ではなく
  //      Lark 実型に合わせる(数値型に文字列を送ると NumberFieldConvFail:1254061 になるため)。
  const fieldsRes = await getTableFields(plan.tableId, baseToken);
  const larkTypeByField = new Map<string, number>(
    (fieldsRes.data?.items ?? []).map((f: any) => [f.field_name as string, f.type as number])
  );
  const actualFields = new Set(larkTypeByField.keys());
  const isNumericField = (field: string) => larkTypeByField.get(field) === 2; // 2 = 数値
  const keyIsNumeric = isNumericField(plan.key);
  const missing = plan.fields.filter((f) => !actualFields.has(f));
  if (missing.length > 0) {
    console.error(
      `[stop] Lark テーブルに未作成のフィールドが ${missing.length} 件あります（投入を中止）:\n  ` +
        missing.join(" / ") +
        `\n  → docs/eigyo-sankou-zu/lark-table-spec.md の通り Lark UI でフィールドを作成してください` +
        `（API作成は権限不可: 1254302）。`
    );
    return;
  }

  // 2) 既存レコード全件取得(record_id 突合用)。キー値 → { record_id, fields }
  const existing = new Map<string, { recordId: string; fields: Record<string, unknown> }>();
  let pageToken: string | undefined;
  let fetched = 0;
  do {
    const res = await getBaseRecords(plan.tableId, { pageSize: 500, pageToken, baseToken });
    const items = res.data?.items ?? [];
    for (const it of items) {
      const f = (it.fields ?? {}) as Record<string, unknown>;
      const k = existingToCompare(f[plan.key]);
      if (k !== "") existing.set(k, { recordId: it.record_id as string, fields: f });
    }
    fetched += items.length;
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  console.log(`既存: ${fetched} 件取得`);

  // 3) create / update / skip の振り分け
  const toCreate: Record<string, any>[] = [];
  const toUpdate: { record_id: string; fields: Record<string, any> }[] = [];
  let skip = 0;
  let noKey = 0;

  for (const row of rows) {
    const keyVal = normalize(row[plan.key], keyIsNumeric);
    if (keyVal === undefined) {
      noKey++;
      continue;
    }
    const desired: Record<string, any> = {};
    for (const field of plan.fields) {
      const v = normalize(row[field], isNumericField(field));
      if (v !== undefined) desired[field] = v;
    }

    const hit = existing.get(String(keyVal));
    if (!hit) {
      toCreate.push(desired);
      continue;
    }
    // 差分検出: desired のフィールドだけ比較(空上書きはしない方針なので欠落は無視)
    const diff: Record<string, any> = {};
    for (const [field, v] of Object.entries(desired)) {
      const cur = existingToCompare(hit.fields[field]);
      if (cur !== String(v)) diff[field] = v;
    }
    if (Object.keys(diff).length > 0) {
      toUpdate.push({ record_id: hit.recordId, fields: diff });
    } else {
      skip++;
    }
  }

  console.log(
    `判定: create=${toCreate.length} / update=${toUpdate.length} / skip=${skip}` +
      (noKey ? ` / キー欠落=${noKey}(無視)` : "")
  );

  // 4) 投入
  if (!EXECUTE) {
    console.log("[dry-run] 書き込みは行いません。実投入は --execute を付けて再実行してください。");
    if (toCreate[0]) console.log("create サンプル:", JSON.stringify(toCreate[0]).slice(0, 300));
    if (toUpdate[0]) console.log("update サンプル:", JSON.stringify(toUpdate[0]).slice(0, 300));
    return;
  }

  if (toCreate.length > 0) {
    console.log(`batchCreate 実行中... (${toCreate.length} 件)`);
    await batchCreateBaseRecords(plan.tableId, toCreate, { baseToken });
  }
  if (toUpdate.length > 0) {
    console.log(`batchUpdate 実行中... (${toUpdate.length} 件)`);
    await batchUpdateBaseRecords(plan.tableId, toUpdate, { baseToken });
  }
  console.log("完了。");
}

async function main() {
  const tables = getLarkTables();
  console.log(`=== 参考図台帳 投入 (${EXECUTE ? "EXECUTE" : "dry-run"}${ONLY ? `, only=${ONLY}` : ""}) ===`);

  const plans: TablePlan[] = [
    {
      label: "参考図面台帳",
      tableId: tables.SANKOU_DAICHO,
      jsonFile: "sankou-daicho.json",
      fields: SANKOU_DAICHO_FIELDS,
      numericFields: new Set(SANKOU_DAICHO_NUMERIC_FIELDS),
      key: SANKOU_DAICHO_KEY,
    },
    {
      label: "参考図面部品マスタ",
      tableId: tables.SANKOU_BUHIN,
      jsonFile: "buhin-master.json",
      fields: SANKOU_BUHIN_FIELDS,
      numericFields: new Set(["ID"]),
      key: SANKOU_BUHIN_KEY,
    },
  ];

  for (const plan of plans) {
    if (ONLY === "daicho" && plan.label !== "参考図面台帳") continue;
    if (ONLY === "buhin" && plan.label !== "参考図面部品マスタ") continue;
    await importTable(plan);
  }

  console.log("\n=== 終了 ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
