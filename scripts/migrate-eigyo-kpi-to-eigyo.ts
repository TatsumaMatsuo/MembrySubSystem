/**
 * 「営業部KPI登録」(PGM011) を L1「KPI」(M013) 配下から 営業部(M003) 配下へ移動。
 *  - 新規 L2 メニュー M003-04「営業部KPI登録」(parent=M003, 順3) を作成
 *  - PGM011 配置メニューID M013-02 → M003-04 (順1, 名称維持)
 *  - アクセス維持: program:PGM011 保有の全プリンシパルに menu:M003-04 を付与。
 *      menu:M003 未保有なら M003 も付与。
 *  - L1「KPI」M013 / 子 M013-01「全社KPI」(空) / M013-02「営業部KPI登録」(空化) を削除
 *  - 孤立する menu:M013 / M013-01 / M013-02 権限(グループ+個別)を削除
 *
 * 既定 DRY-RUN。実行は --execute。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE = process.env.LARK_BASE_TOKEN_MASTER || "J09zbrPDxa5QR8sEgU9jqLlxpxg";
const T_MENU = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const T_PROG = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const T_GROUP = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";
const T_USER = process.env.LARK_TABLE_USER_PERMISSION || "tbl2hvSUkEe3fn7t";

const PROG = "PGM011";
const PARENT = "M003"; // 営業部
const DEST_MENU = "M003-04"; // 新規 L2 営業部KPI登録
const DEST_NAME = "営業部KPI登録";
const DELETE_MENUS = ["M013-02", "M013-01", "M013"];

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

  // ---- 1) 新規 L2 メニュー作成 ----
  console.log(`=== メニュー${tag} ===`);
  if (menus.find((r) => val(r.fields?.["メニューID"]).trim() === DEST_MENU)) {
    console.log(`  ✓ ${DEST_MENU}「${DEST_NAME}」既存 → スキップ`);
  } else {
    console.log(`  + ${DEST_MENU}「${DEST_NAME}」(L2, parent=${PARENT}, 順3)`);
    if (execute) {
      const r: any = await c.bitable.appTableRecord.create({
        path: { app_token: BASE, table_id: T_MENU },
        data: {
          fields: {
            "メニューID": DEST_MENU,
            "メニュー名": DEST_NAME,
            "階層レベル": 2,
            "親メニューID": PARENT,
            "表示順": 3,
            "有効フラグ": true,
          },
        },
      });
      if (r.code !== 0) throw new Error(`create ${DEST_MENU}: ${r.msg}`);
    }
  }

  // ---- 2) プログラム移動 ----
  console.log(`\n=== 機能配置マスタ${tag} ===`);
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

  // ---- 3) アクセス維持 ----
  const groupHasProg = new Set<string>();
  const groupHasParent = new Set<string>();
  for (const r of gp) {
    const id = val(r.fields?.["対象ID"]);
    const type = val(r.fields?.["対象種別"]);
    const name = val(r.fields?.["グループ名"]);
    if (type === "program" && id === PROG && r.fields?.["許可フラグ"] === true) groupHasProg.add(name);
    if (type === "menu" && id === PARENT && r.fields?.["許可フラグ"] === true) groupHasParent.add(name);
  }
  const groupHasDest = new Set(
    gp.filter((r) => val(r.fields?.["対象種別"]) === "menu" && val(r.fields?.["対象ID"]) === DEST_MENU)
      .map((r) => val(r.fields?.["グループ名"]))
  );
  const userName = new Map<string, string>();
  const userHasProg = new Set<string>();
  const userHasParent = new Set<string>();
  for (const r of up) {
    const eid = val(r.fields?.["社員ID"]);
    userName.set(eid, val(r.fields?.["社員名"]));
    const id = val(r.fields?.["対象ID"]);
    const type = val(r.fields?.["対象種別"]);
    if (type === "program" && id === PROG && r.fields?.["許可フラグ"] === true) userHasProg.add(eid);
    if (type === "menu" && id === PARENT && r.fields?.["許可フラグ"] === true) userHasParent.add(eid);
  }
  const userHasDest = new Set(
    up.filter((r) => val(r.fields?.["対象種別"]) === "menu" && val(r.fields?.["対象ID"]) === DEST_MENU)
      .map((r) => val(r.fields?.["社員ID"]))
  );

  console.log(`\n=== 権限付与${tag} ===`);
  console.log(`  PGM011保有: グループ${groupHasProg.size}件 / 個別${userHasProg.size}名`);

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
    if (!groupHasParent.has(g)) { console.log(`  + [G:${g}] menu:${PARENT}`); await createGroupPerm(g, PARENT); }
  }
  for (const eid of userHasProg) {
    const name = userName.get(eid) || "";
    if (!userHasDest.has(eid)) { console.log(`  + [U:${eid}/${name}] menu:${DEST_MENU}`); await createUserPerm(eid, name, DEST_MENU); }
    else console.log(`  ✓ [U:${eid}/${name}] menu:${DEST_MENU} 既存`);
    if (!userHasParent.has(eid)) { console.log(`  + [U:${eid}/${name}] menu:${PARENT}`); await createUserPerm(eid, name, PARENT); }
  }

  // ---- 4) 旧メニュー削除 ----
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

  // ---- 5) 孤立 menu権限削除 ----
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
