/**
 * 棚卸 Phase 0: 在庫アップロード用EXCELの列構成を実査し、Lark「システム在庫情報」の列と突合する。
 *   npx tsx scripts/analyze-tanaoroshi-xlsx.ts <xlsxPath>
 *
 * 目的: STOCK_COLUMN_MAP（EXCEL列名 → Lark列名）を確定する。
 */
import * as XLSX from "xlsx";
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const path = process.argv[2] || "C:/Users/tatsuma.m/Downloads/Othello倉庫別在庫台帳データ (1).xlsx";
const STOCK_TABLE = "tblFG23F6WgRPr5a";

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

async function main() {
  const wb = XLSX.readFile(path);
  console.log(`ファイル: ${path}`);
  console.log(`シート: ${JSON.stringify(wb.SheetNames)}\n`);

  const sheetName = wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const header = (rows[0] || []).map((h) => String(h ?? "").trim());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c !== null && c !== ""));

  console.log(`■ EXCEL: シート"${sheetName}" / ${header.length}列 / データ${dataRows.length}行`);
  header.forEach((h, i) => console.log(`   ${String(i + 1).padStart(2)}. ${XLSX.utils.encode_col(i)}  "${h}"`));

  // Lark 側の列定義
  const fields: any[] = [];
  let t: string | undefined;
  do {
    const r: any = await client.bitable.appTableField.list({
      path: { app_token: process.env.LARK_BASE_TOKEN!, table_id: STOCK_TABLE },
      params: { page_size: 100, page_token: t },
    });
    fields.push(...(r.data?.items || []));
    t = r.data?.has_more ? r.data?.page_token : undefined;
  } while (t);
  const larkNames = fields.map((f) => String(f.field_name));
  const larkType = new Map(fields.map((f) => [String(f.field_name), f.ui_type || f.type]));

  console.log(`\n■ Lark「システム在庫情報」: ${larkNames.length}列`);

  const onlyExcel = header.filter((h) => h && !larkNames.includes(h));
  const onlyLark = larkNames.filter((n) => !header.includes(n));
  console.log(`\n■ EXCELのみ（Larkに無い列）: ${onlyExcel.length}件`);
  onlyExcel.forEach((h) => console.log(`   "${h}"`));
  console.log(`\n■ Larkのみ（EXCELに無い列）: ${onlyLark.length}件`);
  onlyLark.forEach((h) => console.log(`   "${h}"  [${larkType.get(h)}]`));

  const same = JSON.stringify(header.filter(Boolean)) === JSON.stringify(larkNames);
  console.log(`\n■ 列名・列順の一致: ${same ? "✅ 完全一致（そのまま取り込める）" : "⚠ 不一致"}`);
  if (!same) {
    console.log("   位置ごとの差分:");
    for (let i = 0; i < Math.max(header.length, larkNames.length); i++) {
      if (header[i] !== larkNames[i]) console.log(`     [${i}] excel="${header[i] ?? "-"}"  lark="${larkNames[i] ?? "-"}"`);
    }
  }

  if (dataRows.length) {
    console.log(`\n■ 先頭データ行のサンプル`);
    header.forEach((h, i) => console.log(`   "${h}": ${JSON.stringify(dataRows[0][i])}`));
  } else {
    console.log(`\n⚠ データ行が0件（ヘッダーのみのサンプル）。値の型・書式は実データで再確認が必要。`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
