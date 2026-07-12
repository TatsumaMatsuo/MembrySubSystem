/**
 * 「納期変更分析」(PGM010) を 製造部(M005) から 生産本部>生産管理部(M006-03) へ移植。
 *  - PGM010 配置メニューID M005-01 → M006-03 (順1, 名称は維持)
 *  - 旧メニュー M005-01 / M005 を削除
 *  - アクセス維持: 現在 program:PGM010 を許可されている全プリンシパル(グループ/個別)に
 *      menu:M006-03 を付与(冪等)。menu:M006 未保有なら M006 も付与。
 *  - 孤立する menu:M005 / M005-01 権限(グループ+個別)を削除。
 *
 * 既定 DRY-RUN。実行は --execute。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "";
const T_MENU = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const T_GROUP = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";
const T_USER = process.env.LARK_TABLE_USER_PERMISSION || "tbl2hvSUkEe3fn7t";

const PROG = "PGM010";
const DEST_MENU = "M006-03"; // 生産本部 > 生産管理部
const HONBU = "M006";
const DELETE_MENUS = ["M005-01", "M005"];

function val(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x: any) => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || "";
  return String(v);
}

async function fetchAll(c: lark.Client, table: string): Promise<any[]> {
  const items: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await c.bitable.appTableRecord.list({
      path: { app_token: BASE, table_id: table },
      params: { page_size: 500, page_token: pt },
    });
    if (r.code !== 0) throw new Error(`fetch ${table}: ${r.msg}`);
    items.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);
  return items;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const tag = execute ? "" : " (DRY-RUN)";
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const [menus, programs, gp, up] = await Promise.all([
    fetchAll(c, T_MENU),
    fetchAll(c, T_PROG),
    fetchAll(c, T_GROUP),
    fetchAll(c, T_USER),
  ]);

  // ---- 1) プログラム移設 ----
  console.log(`=== 機能配置マスタ${tag} ===`);
  const prog = programs.find((r) => val(r.fields?.["プログラムID"]).trim() === PROG);
  if (!prog) throw new Error(`${PROG} が見つかりません`);
  const curMenu = val(prog.fields?.["配置メニューID"]);
  if (curMenu === DEST_MENU) {
    console.log(`  ✓ ${PROG} 既に 配置=${DEST_MENU} → スキップ`);
  } else {
    console.log(`  ~ ${PROG}「${val(prog.fields?.["プログラム名称"])}」配置 ${curMenu}→${DEST_MENU} 順→1`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.update({
        path: { app_token: BASE, table_id: T_PROG, record_id: prog.record_id },
        data: { fields: { "配置メニューID": DEST_MENU, "表示順": 1 } },
      });
      if (r.code !== 0) throw new Error(`update ${PROG}: ${r.msg}`);
    }
  }

  // ---- 2) アクセス維持: PGM010 を許可されている全プリンシパルを抽出 ----
  // グループ
  const groupHasProg = new Set<string>();
  const groupHasHonbu = new Set<string>();
  for (const r of gp) {
    const id = val(r.fields?.["対象ID"]);
    const type = val(r.fields?.["対象種別"]);
    const name = val(r.fields?.["グループ名"]);
    if (type === "program" && id === PROG && r.fields?.["許可フラグ"] === true) groupHasProg.add(name);
    if (type === "menu" && id === HONBU && r.fields?.["許可フラグ"] === true) groupHasHonbu.add(name);
  }
  const groupHasDest = new Set(
    gp.filter((r) => val(r.fields?.["対象種別"]) === "menu" && val(r.fields?.["対象ID"]) === DEST_MENU)
      .map((r) => val(r.fields?.["グループ名"]))
  );

  // 個別 (社員ID -> 社員名)
  const userName = new Map<string, string>();
  const userHasProg = new Set<string>();
  const userHasHonbu = new Set<string>();
  for (const r of up) {
    const eid = val(r.fields?.["社員ID"]);
    userName.set(eid, val(r.fields?.["社員名"]));
    const id = val(r.fields?.["対象ID"]);
    const type = val(r.fields?.["対象種別"]);
    if (type === "program" && id === PROG && r.fields?.["許可フラグ"] === true) userHasProg.add(eid);
    if (type === "menu" && id === HONBU && r.fields?.["許可フラグ"] === true) userHasHonbu.add(eid);
  }
  const userHasDest = new Set(
    up.filter((r) => val(r.fields?.["対象種別"]) === "menu" && val(r.fields?.["対象ID"]) === DEST_MENU)
      .map((r) => val(r.fields?.["社員ID"]))
  );

  console.log(`\n=== 権限付与${tag} ===`);
  console.log(`  PGM010保有: グループ${groupHasProg.size}件 / 個別${userHasProg.size}名`);

  async function createGroupPerm(group: string, targetId: string) {
    if (execute) {
      const r: any = await c.bitable.appTableRecord.create({
        path: { app_token: BASE, table_id: T_GROUP },
        data: { fields: { "グループ名": group, "対象種別": "menu", "対象ID": targetId, "許可フラグ": true } },
      });
      if (r.code !== 0) throw new Error(`grant group ${group} ${targetId}: ${r.msg}`);
    }
  }
  async function createUserPerm(eid: string, name: string, targetId: string) {
    if (execute) {
      const r: any = await c.bitable.appTableRecord.create({
        path: { app_token: BASE, table_id: T_USER },
        data: { fields: { "社員ID": eid, "社員名": name, "対象種別": "menu", "対象ID": targetId, "許可フラグ": true } },
      });
      if (r.code !== 0) throw new Error(`grant user ${eid} ${targetId}: ${r.msg}`);
    }
  }

  for (const g of groupHasProg) {
    if (!groupHasDest.has(g)) { console.log(`  + [G:${g}] menu:${DEST_MENU}`); await createGroupPerm(g, DEST_MENU); }
    else console.log(`  ✓ [G:${g}] menu:${DEST_MENU} 既存`);
    if (!groupHasHonbu.has(g)) { console.log(`  + [G:${g}] menu:${HONBU}`); await createGroupPerm(g, HONBU); }
  }
  for (const eid of userHasProg) {
    const name = userName.get(eid) || "";
    if (!userHasDest.has(eid)) { console.log(`  + [U:${eid}/${name}] menu:${DEST_MENU}`); await createUserPerm(eid, name, DEST_MENU); }
    else console.log(`  ✓ [U:${eid}/${name}] menu:${DEST_MENU} 既存`);
    if (!userHasHonbu.has(eid)) { console.log(`  + [U:${eid}/${name}] menu:${HONBU}`); await createUserPerm(eid, name, HONBU); }
  }

  // ---- 3) 旧メニュー削除 ----
  console.log(`\n=== 旧メニュー削除${tag} ===`);
  for (const id of DELETE_MENUS) {
    const rec = menus.find((r) => val(r.fields?.["メニューID"]).trim() === id);
    if (!rec) { console.log(`  ✓ ${id} 無し`); continue; }
    console.log(`  - ${id}「${val(rec.fields?.["メニュー名"])}」削除`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.delete({
        path: { app_token: BASE, table_id: T_MENU, record_id: rec.record_id },
      });
      if (r.code !== 0) throw new Error(`delete menu ${id}: ${r.msg}`);
    }
  }

  // ---- 4) 孤立 menu権限 (M005, M005-01) 削除 ----
  console.log(`\n=== 孤立 menu権限削除${tag} ===`);
  const orphanG = gp.filter((r) => val(r.fields?.["対象種別"]) === "menu" && DELETE_MENUS.includes(val(r.fields?.["対象ID"])));
  const orphanU = up.filter((r) => val(r.fields?.["対象種別"]) === "menu" && DELETE_MENUS.includes(val(r.fields?.["対象ID"])));
  console.log(`  グループ${orphanG.length}件 / 個別${orphanU.length}件`);
  for (const r of orphanG) {
    if (execute) {
      const d: any = await c.bitable.appTableRecord.delete({ path: { app_token: BASE, table_id: T_GROUP, record_id: r.record_id } });
      if (d.code !== 0) throw new Error(`del gperm: ${d.msg}`);
    }
  }
  for (const r of orphanU) {
    if (execute) {
      const d: any = await c.bitable.appTableRecord.delete({ path: { app_token: BASE, table_id: T_USER, record_id: r.record_id } });
      if (d.code !== 0) throw new Error(`del uperm: ${d.msg}`);
    }
  }

  console.log(`\n=== ${execute ? "反映完了" : "DRY-RUN 完了。--execute で反映"} ===`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
