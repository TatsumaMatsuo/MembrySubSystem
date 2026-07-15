/**
 * 社内AIチャット(#32 / Epic #30 段階1) メニュー投入 + 全社員への権限付与
 *
 * 配置(決定): 「共通」トップメニュー(L1)配下に L2「AIアシスタント」を作り、
 *   その下に プログラム「社内AIチャット」を置く。
 *   URLパス = 既存 Lark Bot(shainai)への applink ディープリンク(方式C: 新規公開口を作らず最安全)。
 * 公開範囲(決定): 全社員。グループ権限マスタに「トップレベル部署ごと」の許可行を作る
 *   (社員の部署チェーンは expandDepartmentChain でトップ部署まで展開されるため、
 *    トップ部署を許可すれば配下の全社員に効く)。
 *
 * 自己探索・冪等:
 *   - 共通L1 は「メニュー名=共通 かつ 階層レベル=1」で検索(既定 M001 想定だが名前優先)。
 *   - L2/プログラムID は既存最大採番の続きを自動採番(PGMは max+1)。
 *   - 既存(同一ID / 同一グループ×対象)があればスキップ。
 *
 * 実行: npx tsx scripts/register-chat-menu.ts [--dry-run]
 *   ※ ローカル .env の Lark 認証情報が最新(ローテ後)である必要があります。
 *     token取得失敗(99991661)時は Amplify の現行 LARK_APP_ID/LARK_APP_SECRET を .env に反映してください。
 */
import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const BASE_TOKEN = process.env.LARK_BASE_TOKEN_MASTER || "";
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "tblQUDXmR38J6KWh";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "tblmFd1WLLegSKPO";
const TABLE_GROUP_PERMISSION = process.env.LARK_TABLE_GROUP_PERMISSION || "tbldL8lBsCnhCJQx";

const L1_NAME = "共通";
const L2_NAME = "AIアシスタント";
const L2_ICON = "Bot"; // Sidebar ICON_MAP に無い場合は既定アイコンにフォールバック
const PROGRAM_NAME = "社内AIチャット";
// 方式C: 埋め込みWebチャットは使わず、既存 Lark Bot(shainai)へのディープリンクにする。
// セキュリティ上、新規インバウンド/新規公開エンドポイントを作らず既存の認可済みLarkチャネルへ誘導する。
// applink(国際版=larksuite): Bot を開く。appId は shainai Bot(Membry認証アプリとは別)。
const SHAINAI_BOT_APP_ID = "cli_aac2ce0c2778de18";
const PROGRAM_URL = `https://applink.larksuite.com/client/bot/open?appId=${SHAINAI_BOT_APP_ID}`;

function getField(rec: any, name: string): string {
  const v = rec?.fields?.[name];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text || x?.name || "")).join("");
  if (typeof v === "object") return v.text || v.name || "";
  return String(v);
}

async function fetchAll(client: lark.Client, tableId: string, filter?: string) {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await client.bitable.appTableRecord.list({
      path: { app_token: BASE_TOKEN, table_id: tableId },
      params: { page_size: 100, page_token: pageToken, ...(filter ? { filter } : {}) },
    });
    if (res.code !== 0) throw new Error(`Fetch failed (${tableId}): ${res.msg}`);
    items.push(...(res.data?.items || []));
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return items;
}

/** トップレベル部署名(会社ルート"0"直下)の一覧。全社員はこのいずれかの配下に属する。 */
async function fetchTopLevelDepartments(client: lark.Client): Promise<string[]> {
  const names: string[] = [];
  let pageToken: string | undefined;
  do {
    const r: any = await client.contact.department.list({
      params: {
        department_id_type: "open_department_id",
        parent_department_id: "0",
        fetch_child: false,
        page_size: 50,
        page_token: pageToken,
      },
    });
    if (r.code !== 0) throw new Error(`部署取得失敗: ${r.msg}`);
    for (const d of r.data?.items || []) {
      const n = String(d.name || "").trim();
      if (n) names.push(n);
    }
    pageToken = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pageToken);
  return [...new Set(names)];
}

async function createRecord(client: lark.Client, tableId: string, fields: Record<string, any>) {
  const res: any = await client.bitable.appTableRecord.create({
    path: { app_token: BASE_TOKEN, table_id: tableId },
    data: { fields },
  });
  if (res.code !== 0) throw new Error(`Create failed (${tableId}): ${res.msg}`);
  return res.data?.record;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const tag = dryRun ? " (DRY-RUN)" : "";
  const client = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  // === 1. 共通L1 を特定 ===
  const menus = await fetchAll(client, TABLE_MENU_DISPLAY);
  const l1 = menus.find(
    (m) => Number(getField(m, "階層レベル")) === 1 && getField(m, "メニュー名").trim() === L1_NAME
  );
  if (!l1) throw new Error(`L1「${L1_NAME}」が見つかりません。メニュー表示マスタを確認してください。`);
  const l1Id = getField(l1, "メニューID").trim();
  console.log(`共通L1: ${l1Id}「${L1_NAME}」`);

  // === 2. L2「AIアシスタント」を用意(なければ作成) ===
  let l2 = menus.find(
    (m) =>
      Number(getField(m, "階層レベル")) === 2 &&
      getField(m, "親メニューID").trim() === l1Id &&
      getField(m, "メニュー名").trim() === L2_NAME
  );
  let l2Id = l2 ? getField(l2, "メニューID").trim() : `${l1Id}-AI`;
  if (!l2) {
    const siblings = menus.filter(
      (m) => Number(getField(m, "階層レベル")) === 2 && getField(m, "親メニューID").trim() === l1Id
    );
    const nextSort =
      siblings.reduce((mx, m) => Math.max(mx, Number(m.fields?.["表示順"]) || 0), 0) + 1;
    console.log(`  + L2 ${l2Id}「${L2_NAME}」(親=${l1Id}, 順=${nextSort}) を登録${tag}`);
    if (!dryRun) {
      await createRecord(client, TABLE_MENU_DISPLAY, {
        "メニューID": l2Id,
        "メニュー名": L2_NAME,
        "階層レベル": 2,
        "親メニューID": l1Id,
        "表示順": nextSort,
        "アイコン": L2_ICON,
        "有効フラグ": true,
      });
    }
  } else {
    console.log(`  ✓ L2 ${l2Id}「${L2_NAME}」 既存 → スキップ`);
  }

  // === 3. プログラム(社内AIチャット)を用意 ===
  //   名称で検索し、無ければPGM自動採番で作成、有ればURLパスの差分のみ更新(方式変更の移行に対応)。
  const programs = await fetchAll(client, TABLE_FUNCTION_PLACEMENT);
  const prog = programs.find((p) => getField(p, "プログラム名称").trim() === PROGRAM_NAME);
  let progId = prog ? getField(prog, "プログラムID").trim() : "";
  if (!prog) {
    const maxNum = programs.reduce((mx, p) => {
      const m = /^PGM0*(\d+)$/.exec(getField(p, "プログラムID").trim());
      return m ? Math.max(mx, Number(m[1])) : mx;
    }, 0);
    progId = `PGM${String(maxNum + 1).padStart(3, "0")}`;
    console.log(`  + プログラム ${progId}「${PROGRAM_NAME}」 → ${PROGRAM_URL} (配置=${l2Id})${tag}`);
    if (!dryRun) {
      await createRecord(client, TABLE_FUNCTION_PLACEMENT, {
        "プログラムID": progId,
        "プログラム名称": PROGRAM_NAME,
        "配置メニューID": l2Id,
        "URLパス": PROGRAM_URL,
        "表示順": 1,
        "有効フラグ": true,
      });
    }
  } else {
    const curUrl = getField(prog, "URLパス").trim();
    if (curUrl !== PROGRAM_URL) {
      console.log(`  ~ プログラム ${progId}「${PROGRAM_NAME}」URLパス更新: ${curUrl} → ${PROGRAM_URL}${tag}`);
      if (!dryRun) {
        const up: any = await client.bitable.appTableRecord.update({
          path: { app_token: BASE_TOKEN, table_id: TABLE_FUNCTION_PLACEMENT, record_id: prog.record_id },
          data: { fields: { "URLパス": PROGRAM_URL } },
        });
        if (up.code !== 0) throw new Error(`Program update failed (${progId}): ${up.msg}`);
      }
    } else {
      console.log(`  ✓ プログラム ${progId}「${PROGRAM_NAME}」 既存(URL一致) → スキップ`);
    }
  }

  // === 4. 全社員へ権限付与(トップ部署ごとに L1 + L2 + program を許可) ===
  const depts = await fetchTopLevelDepartments(client);
  console.log(`\n全社員付与対象=トップ部署 ${depts.length}件: ${depts.join(", ")}`);
  const targets: { type: "menu" | "program"; id: string }[] = [
    { type: "menu", id: l1Id },
    { type: "menu", id: l2Id },
    { type: "program", id: progId },
  ];

  let created = 0;
  let skipped = 0;
  for (const group of depts) {
    const existing = await fetchAll(
      client,
      TABLE_GROUP_PERMISSION,
      `CurrentValue.[グループ名] = "${group}"`
    );
    const has = (type: string, id: string) =>
      existing.some((r) => getField(r, "対象種別") === type && getField(r, "対象ID") === id);
    for (const t of targets) {
      if (has(t.type, t.id)) {
        skipped++;
        continue;
      }
      console.log(`  + [${group}] ${t.type} ${t.id} を許可${tag}`);
      if (!dryRun) {
        await createRecord(client, TABLE_GROUP_PERMISSION, {
          "グループ名": group,
          "対象種別": t.type,
          "対象ID": t.id,
          "許可フラグ": true,
        });
      }
      created++;
    }
  }

  console.log(`\n=== 完了${dryRun ? " (DRY-RUN: 変更なし)" : ""} ===`);
  console.log(`  メニュー: L1=${l1Id} / L2=${l2Id}`);
  console.log(`  プログラム: ${progId} → ${PROGRAM_URL}`);
  console.log(`  権限: 新規 ${created} 件 / スキップ(既存) ${skipped} 件`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
