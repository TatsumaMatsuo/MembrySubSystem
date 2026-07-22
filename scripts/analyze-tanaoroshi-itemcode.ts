/**
 * 棚卸 Phase 0: 品番の書式分布を分析
 *   npx tsx scripts/analyze-tanaoroshi-itemcode.ts
 *
 * 目的: Code 39 はチェックディジットが任意で部分読み取り(truncation)の誤読リスクがある。
 *       品番の書式を実測し、読取結果の妥当性検証パターンを決める。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const TABLE = "tblFG23F6WgRPr5a";
const BASE = process.env.LARK_BASE_TOKEN!;

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

/** 文字種パターンへ抽象化: 英大文字=A, 数字=9, その他はそのまま */
const shape = (s: string) => s.replace(/[A-Z]/g, "A").replace(/[a-z]/g, "a").replace(/[0-9]/g, "9");

/** Code 39 が表現できる文字集合 */
const CODE39 = /^[0-9A-Z\-. $\/+%]*$/;

async function main() {
  const codes = new Set<string>();
  let token: string | undefined;
  do {
    const r: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE, table_id: TABLE },
      params: { page_size: 500, page_token: token, field_names: JSON.stringify(["品番", "品名", "品名2"]) },
    });
    for (const i of r.data?.items || []) {
      const c = String((i.fields as any)?.["品番"] ?? "").trim();
      if (c) codes.add(c);
    }
    token = r.data?.has_more ? r.data?.page_token : undefined;
  } while (token);

  console.log(`ユニーク品番数: ${codes.size}\n`);

  // 書式パターン別
  const byShape = new Map<string, string[]>();
  for (const c of codes) {
    const s = shape(c);
    if (!byShape.has(s)) byShape.set(s, []);
    byShape.get(s)!.push(c);
  }
  console.log("■ 書式パターン別（文字種に抽象化: A=英大, 9=数字）");
  [...byShape.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([s, list]) =>
      console.log(`   ${s.padEnd(12)} ${String(list.length).padStart(5)}件  例: ${list.slice(0, 4).join(", ")}`)
    );

  // 長さ分布
  const byLen = new Map<number, number>();
  for (const c of codes) byLen.set(c.length, (byLen.get(c.length) || 0) + 1);
  console.log("\n■ 長さ分布");
  [...byLen.entries()].sort((a, b) => a[0] - b[0]).forEach(([l, n]) => console.log(`   ${l}文字: ${n}件`));

  // Code 39 で表現できない文字を含む品番
  const bad = [...codes].filter((c) => !CODE39.test(c));
  console.log(`\n■ Code 39 で表現できない文字を含む品番: ${bad.length}件`);
  if (bad.length) console.log(`   例: ${bad.slice(0, 20).join(", ")}`);

  // 先頭1文字の分布（品目カテゴリ？）
  const byHead = new Map<string, number>();
  for (const c of codes) byHead.set(c[0], (byHead.get(c[0]) || 0) + 1);
  console.log("\n■ 先頭文字の分布");
  [...byHead.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log(`   ${h}: ${n}件`));

  // ★誤読リスク: ある品番が別の品番の先頭部分になっているケース（truncation誤読）
  const sorted = [...codes].sort();
  const prefixHits: string[] = [];
  for (const c of sorted) {
    for (const d of sorted) {
      if (c !== d && d.startsWith(c)) {
        prefixHits.push(`${c} ⊂ ${d}`);
        break;
      }
    }
  }
  console.log(`\n■ 他品番の接頭辞になっている品番: ${prefixHits.length}件`);
  console.log(`   （Code 39 の部分読み取りで別品番と誤認されうる組み合わせ）`);
  if (prefixHits.length) console.log(`   例: ${prefixHits.slice(0, 15).join(" / ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
