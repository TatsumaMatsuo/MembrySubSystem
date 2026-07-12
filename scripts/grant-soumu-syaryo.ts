/**
 * 総務部グループに syaryo関連プログラム権限を付与
 * - PGM030: 閲覧
 * - PGM031: 管理者操作
 *
 * 冪等: 既存レコードがあればスキップ
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const GROUP = {
  id: "od-a933a3dabe6dcb15336f189900ff48be",
  name: "総務部",
};

const TARGETS = [
  { program_id: "PGM030", description: "閲覧権限" },
  { program_id: "PGM031", description: "管理者操作権限" },
];

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => x?.text || x?.name || x).join("");
  if (typeof v === "object") return v.text || v.name || JSON.stringify(v);
  return String(v);
}

async function main() {
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // 既存レコード取得（総務部 + program）
  const res: any = await client.bitable.appTableRecord.list({
    path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
    params: { page_size: 500, filter: `CurrentValue.[グループ名] = "${GROUP.name}"` },
  });
  const existing = res.data?.items || [];
  console.log(`総務部 既存権限: ${existing.length} 件\n`);

  for (const target of TARGETS) {
    const dup = existing.find((r: any) =>
      val(r.fields?.["対象種別"]) === "program" &&
      val(r.fields?.["対象ID"]) === target.program_id
    );

    if (dup) {
      console.log(`  ✓ ${target.program_id} は既に許可済み (record_id=${dup.record_id}) → スキップ`);
      continue;
    }

    console.log(`  + ${target.program_id} (${target.description}) を許可付与...`);
    const cr: any = await client.bitable.appTableRecord.create({
      path: { app_token: BASE_TOKEN, table_id: TABLE_GROUP_PERMISSION },
      data: {
        fields: {
          "グループID": GROUP.id,
          "グループ名": GROUP.name,
          "対象種別": "program",
          "対象ID": target.program_id,
          "許可フラグ": true,
        },
      },
    });
    if (cr.code !== 0) throw new Error(`Create failed for ${target.program_id}: ${cr.msg}`);
    console.log(`    -> created (record_id=${cr.data?.record?.record_id})`);
  }

  console.log("\n=== 完了 ===");
}

main().catch(e => {
  console.error("[fatal]", e);
  process.exit(1);
});
