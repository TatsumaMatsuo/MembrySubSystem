/**
 * 棚卸 Phase 0: システム在庫情報テーブルのデータ分布分析
 *   npx tsx scripts/analyze-tanaoroshi-stock.ts
 *
 * 目的: 締日スナップショットの粒度、倉庫数、倉庫あたり品目数を実測し、
 *       bootstrap（起動時の一括DL）の設計判断材料とする。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const TABLE = "tblFG23F6WgRPr5a"; // システム在庫情報
const BASE = process.env.LARK_BASE_TOKEN!;

const client = new lark.Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: lark.AppType.SelfBuild,
  domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
});

const jst = (ms: any) => (ms ? new Date(Number(ms) + 9 * 3600 * 1000).toISOString().slice(0, 10) : "(空)");
const num = (v: any) => Number(String(v ?? "").replace(/,/g, "").trim() || 0);

async function main() {
  const rows: any[] = [];
  let token: string | undefined;
  do {
    const r: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE, table_id: TABLE },
      params: { page_size: 500, page_token: token },
    });
    rows.push(...(r.data?.items || []).map((i: any) => i.fields));
    token = r.data?.has_more ? r.data?.page_token : undefined;
  } while (token);

  console.log(`総レコード数: ${rows.length}\n`);

  // 締日の分布
  const byDate = new Map<string, number>();
  for (const f of rows) byDate.set(jst(f["締日"]), (byDate.get(jst(f["締日"])) || 0) + 1);
  console.log("■ 締日ごとの件数");
  [...byDate.entries()].sort().forEach(([d, c]) => console.log(`   ${d}  ${c}件`));

  // 最新締日を対象に分析
  const latest = [...byDate.keys()].sort().pop()!;
  const cur = rows.filter((f) => jst(f["締日"]) === latest);
  console.log(`\n■ 最新締日 ${latest} を対象に分析 (${cur.length}件)`);

  // 倉庫別
  const wh = new Map<string, { name: string; items: Set<string>; nonZero: number; qty: number }>();
  for (const f of cur) {
    const code = String(f["倉庫コード"] ?? "");
    if (!wh.has(code)) wh.set(code, { name: String(f["倉庫"] ?? ""), items: new Set(), nonZero: 0, qty: 0 });
    const w = wh.get(code)!;
    w.items.add(String(f["品番"] ?? ""));
    const q = num(f["在庫数"]);
    if (q !== 0) w.nonZero++;
    w.qty += q;
  }
  console.log(`\n■ 倉庫数: ${wh.size}`);
  console.log("   コード | 倉庫名                  | 品目数 | 在庫数≠0 | 在庫数合計");
  [...wh.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([c, w]) =>
      console.log(
        `   ${c.padStart(6)} | ${w.name.padEnd(22)} | ${String(w.items.size).padStart(6)} | ${String(w.nonZero).padStart(8)} | ${w.qty.toLocaleString()}`
      )
    );

  // 品番のユニーク数と重複（倉庫＋品番でユニークか＝突合単位の妥当性検証）
  const keys = new Set<string>();
  let dup = 0;
  const dupSample: string[] = [];
  for (const f of cur) {
    const k = `${f["倉庫コード"]}|${f["品番"]}`;
    if (keys.has(k)) {
      dup++;
      if (dupSample.length < 5) dupSample.push(k);
    }
    keys.add(k);
  }
  const items = new Set(cur.map((f) => String(f["品番"])));
  console.log(`\n■ ユニーク品番数: ${items.size}`);
  console.log(`■ 倉庫+品番の重複行: ${dup}件 ${dup ? `(例: ${dupSample.join(", ")})` : "→ 倉庫+品目で一意"}`);

  // 棚番の充足状況（スコープ外だが将来用）
  const withTana = cur.filter((f) => String(f["棚番"] ?? "").trim()).length;
  console.log(`■ 棚番が入っている行: ${withTana}/${cur.length}`);

  // 棚卸数・調整数の使用状況（基幹の取込先候補）
  const withTanaoroshi = cur.filter((f) => num(f["棚卸数"]) !== 0).length;
  console.log(`■ 棚卸数が0以外の行: ${withTanaoroshi}/${cur.length}`);

  // 型の実態（数値がテキストで入っている問題）
  console.log(`\n■ サンプル値の型確認`);
  const s = cur[0];
  ["倉庫コード", "在庫数", "棚卸数", "単位", "品名", "品名2"].forEach((k) =>
    console.log(`   ${k}: ${JSON.stringify(s?.[k])} (${typeof s?.[k]})`)
  );

  // bootstrap ペイロード見積り
  const perItem = JSON.stringify({ c: "F00015", n: "HTB (F10T) M16×50", u: "本", s: 740 }).length;
  const maxItems = Math.max(...[...wh.values()].map((w) => w.items.size));
  console.log(
    `\n■ bootstrap 見積り: 最大倉庫 ${maxItems}品目 × 約${perItem}B ≒ ${Math.round((maxItems * perItem) / 1024)}KB`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
