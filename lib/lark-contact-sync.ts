/**
 * Lark Contact → Bitable 社員マスタ 自前同期コア。
 *
 * 定期ジョブ/CLI/API から共通で呼ぶ。Contact ディレクトリの全ユーザーを列挙し、
 * 社員マスタ(tblXpm1d05ovRf1y @ master base)へ open_id をキーに upsert する。
 *
 * 設計の詳細は docs/lark-contact-sync/README.md を参照。
 *
 * ⚠️ 氏名/社員番号/携帯/在職状態/custom_attrs の取得には Lark Contact の
 *    プロフィール読取スコープが必要。未付与だと user.get は email 等のみを返す。
 *    applySync は dryRun=false の前に checkContactScopes() で必ず検証すること。
 */
import {
  getLarkClient,
  getBaseRecords,
  batchCreateBaseRecords,
  batchUpdateBaseRecords,
  getLarkBaseTokenForMaster,
} from "./lark-client";

export const EMP_TABLE_ID = "tblXpm1d05ovRf1y"; // 社員マスタ @ master base

/** 社員マスタの書込可能フィールド名（ルックアップ列は書込不可なので含めない） */
export const F = {
  code: "社員コード", // ← employee_no
  name: "社員名", // ← name（名前検索が読む text 列）
  retired: "退職者フラグ", // ← status.is_resigned / ディレクトリ非在籍
  member: "社員名 (メンバー )", // People 型: [{ id: open_id }] 突合キーの本体
} as const;

/** Contact から正規化したユーザー1件 */
export interface ContactUser {
  openId: string;
  email: string;
  userId: string;
  name: string;
  employeeNo: string;
  mobile: string;
  jobTitle: string;
  isResigned: boolean;
  /** custom_attrs を attr_key → 表示値 に正規化したもの */
  customAttrs: Record<string, string>;
  raw: any;
}

export interface SyncReport {
  dryRun: boolean;
  contactCount: number; // Contact ディレクトリ人数
  masterCount: number; // 社員マスタ行数
  created: number;
  updated: number;
  /** is_resigned=true を確認できた退職者だけ退職フラグを立てた件数 */
  retired: number;
  /** 退職候補(列挙非在籍)のうち可視範囲外で退職可否を判定できなかった件数 */
  retireUnresolved: number;
  skippedNoOpenId: number; // open_id を持たない手動行
  errors: string[];
  durationMs: number;
  // dry-run 時の内訳プレビュー（先頭のみ）
  preview: {
    create: Array<{ openId: string; name: string; employeeNo: string }>;
    update: Array<{ openId: string; name: string; changed: string[] }>;
    retire: Array<{ openId: string; name: string }>;
  };
}

// ---------------------------------------------------------------------------
// 1. Contact 列挙
// ---------------------------------------------------------------------------

/** 全部署の open_department_id を取得（ルート配下を再帰） */
async function listAllDepartmentIds(): Promise<string[]> {
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const ids = new Set<string>(["0"]); // ルート直属ユーザーも拾う
  let pageToken: string | undefined;
  do {
    const r: any = await client.contact.department.list({
      params: {
        parent_department_id: "0",
        fetch_child: true,
        page_size: 50,
        page_token: pageToken,
        department_id_type: "open_department_id",
      },
    });
    for (const d of r.data?.items || []) if (d.open_department_id) ids.add(d.open_department_id);
    pageToken = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pageToken);
  return [...ids];
}

/** Contact ディレクトリの全 open_id を集約 */
async function collectOpenIds(deptIds: string[]): Promise<Set<string>> {
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const openIds = new Set<string>();
  for (const dep of deptIds) {
    let pageToken: string | undefined;
    do {
      try {
        const r: any = await client.contact.user.list({
          params: {
            department_id: dep,
            page_size: 50,
            page_token: pageToken,
            department_id_type: "open_department_id",
            user_id_type: "open_id",
          },
        });
        for (const u of r.data?.items || []) if (u.open_id) openIds.add(u.open_id);
        pageToken = r.data?.has_more ? r.data?.page_token : undefined;
      } catch {
        // 個別部署の失敗は無視（権限のない部署など）
        pageToken = undefined;
      }
    } while (pageToken);
  }
  return openIds;
}

/** custom_attrs を attr_key → 表示文字列 に正規化 */
function normalizeCustomAttrs(attrs: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(attrs)) return out;
  for (const a of attrs) {
    const key = a?.type || a?.id;
    if (!key) continue;
    const v = a?.value;
    // value は { text } / { name } / { generic_user } / { option_value } 等いずれか
    const text =
      v?.text ?? v?.name ?? v?.option_value?.name ?? v?.option_id ?? (typeof v === "string" ? v : "");
    out[String(key)] = text == null ? "" : String(text);
  }
  return out;
}

/** open_id 群を contact.user.batch で詳細解決（最大50件/回） */
async function resolveUsers(openIds: string[]): Promise<Map<string, ContactUser>> {
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const map = new Map<string, ContactUser>();
  for (let i = 0; i < openIds.length; i += 50) {
    const chunk = openIds.slice(i, i + 50);
    const r: any = await client.contact.user.batch({
      params: { user_ids: chunk, user_id_type: "open_id", department_id_type: "open_department_id" } as any,
    });
    for (const u of r.data?.items || []) {
      if (!u.open_id) continue;
      map.set(u.open_id, {
        openId: u.open_id,
        email: u.email || u.enterprise_email || "",
        userId: u.user_id || "",
        name: u.name || "",
        employeeNo: u.employee_no || "",
        mobile: u.mobile || "",
        jobTitle: u.job_title || "",
        isResigned: u.status?.is_resigned === true,
        customAttrs: normalizeCustomAttrs(u.custom_attrs),
        raw: u,
      });
    }
  }
  return map;
}

/** Contact ディレクトリ全ユーザーを正規化して返す */
export async function enumerateContactUsers(): Promise<Map<string, ContactUser>> {
  const deptIds = await listAllDepartmentIds();
  const openIds = await collectOpenIds(deptIds);
  return resolveUsers([...openIds]);
}

/**
 * 指定 open_id 群の退職状態を Lark に直接問い合わせる（退職判定の確証用）。
 * - Lark が返したユーザーのみ Map に入れ、値は status.is_resigned。
 * - 返らなかった open_id は「判定不能」(=可視範囲外 41050 等)。呼び出し側で未解決として扱う。
 * 退職者はディレクトリ列挙には出ないが、可視範囲内なら batch が is_resigned=true で返す。
 */
export async function resolveResignedStatus(openIds: string[]): Promise<Map<string, boolean>> {
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const map = new Map<string, boolean>();
  for (let i = 0; i < openIds.length; i += 50) {
    const chunk = openIds.slice(i, i + 50);
    try {
      const r: any = await client.contact.user.batch({
        params: { user_ids: chunk, user_id_type: "open_id", department_id_type: "open_department_id" } as any,
      });
      for (const u of r.data?.items || []) {
        if (u.open_id) map.set(u.open_id, u.status?.is_resigned === true);
      }
    } catch {
      // チャンク全体が権限エラーでも、個々は未解決として扱えばよいので無視
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// プリフライト: プロフィール読取スコープが付与されているか検証
// ---------------------------------------------------------------------------

export interface ScopeCheck {
  ok: boolean;
  missing: string[]; // 取得できなかった項目（＝不足スコープの目安）
  sample: Record<string, any>;
}

/**
 * 任意の1ユーザーを user.get で取得し、氏名等が返るかでスコープ付与を判定する。
 * 氏名すら返らない場合は書込を中止すべき（空値でマスタを破壊しないため）。
 */
export async function checkContactScopes(): Promise<ScopeCheck> {
  const client = getLarkClient();
  if (!client) throw new Error("Lark client not initialized");
  const deptIds = await listAllDepartmentIds();
  const openIds = await collectOpenIds(deptIds.slice(0, 5));
  const first = [...openIds][0];
  if (!first) return { ok: false, missing: ["(ユーザーを列挙できません)"], sample: {} };

  const r: any = await client.contact.user.get({
    path: { user_id: first },
    params: { user_id_type: "open_id", department_id_type: "open_department_id" },
  });
  const u = r.data?.user || {};
  const missing: string[] = [];
  if (!u.name) missing.push("name (contact:user.base:readonly)");
  if (!u.employee_no) missing.push("employee_no (contact:user.employee_id:readonly)");
  if (!u.mobile) missing.push("mobile (contact:user.phone:readonly)");
  if (u.status === undefined) missing.push("status (contact:user.employee:readonly)");
  if (u.custom_attrs === undefined) missing.push("custom_attrs (contact:user.custom_attr:readonly)");
  // 氏名が取れれば最低限の同期は可能とみなす
  return { ok: !!u.name, missing, sample: u };
}

// ---------------------------------------------------------------------------
// 2. 社員マスタ 読込
// ---------------------------------------------------------------------------

interface MasterRow {
  recordId: string;
  openId: string;
  fields: Record<string, any>;
}

function extractOpenId(memberValue: any): string {
  const arr = Array.isArray(memberValue) ? memberValue : memberValue ? [memberValue] : [];
  const m = arr.find((p: any) => typeof p?.id === "string");
  return m?.id || "";
}

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  if (typeof v === "object") return v.text ?? v.name ?? "";
  return String(v);
}

async function readMaster(baseToken: string): Promise<MasterRow[]> {
  const rows: MasterRow[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await getBaseRecords(EMP_TABLE_ID, {
      baseToken,
      pageSize: 500,
      pageToken,
    });
    for (const it of res.data?.items || []) {
      const fields = it.fields || {};
      rows.push({ recordId: it.record_id, openId: extractOpenId(fields[F.member]), fields });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return rows;
}

// ---------------------------------------------------------------------------
// 3 + 4. 突合 & 反映
// ---------------------------------------------------------------------------

/**
 * Contact ユーザーから社員マスタの「書込フィールド」を組み立てる。
 * ルックアップで自動補完される列(部署/社員番号/職位/メール)は含めない。
 * custom_attrs 用の列はスコープ付与後に列を新設してからここへ追加する。
 *
 * ⚠️ Lark側が空の項目(社員番号/氏名)は **含めない**。空で上書きして既存の手入力値を
 *    消さないため（Larkの社員番号未入力アカウントが既存社員コードを消す事故の防止）。
 */
function buildFields(u: ContactUser, retired: boolean): Record<string, any> {
  const fields: Record<string, any> = {
    [F.member]: [{ id: u.openId }],
    [F.retired]: retired,
  };
  if (u.employeeNo) fields[F.code] = u.employeeNo; // 空なら既存を保持
  if (u.name) fields[F.name] = u.name; // 空なら既存を保持
  return fields;
}

/** 既存行と新フィールドを比較し、差分のあるキーだけ返す（冪等更新用） */
function diffFields(current: Record<string, any>, next: Record<string, any>): Record<string, any> {
  const changed: Record<string, any> = {};
  for (const [k, v] of Object.entries(next)) {
    if (k === F.member) {
      // People は open_id の一致だけ見る
      if (extractOpenId(current[k]) !== extractOpenId(v)) changed[k] = v;
    } else if (k === F.retired) {
      if ((current[k] === true) !== (v === true)) changed[k] = v;
    } else {
      if (textOf(current[k]).trim() !== textOf(v).trim()) changed[k] = v;
    }
  }
  return changed;
}

export async function syncLarkContacts(options?: {
  dryRun?: boolean;
}): Promise<SyncReport> {
  const dryRun = options?.dryRun !== false; // 既定 dry-run（安全側）
  const startedAt = Date.now();
  const baseToken = getLarkBaseTokenForMaster();
  const errors: string[] = [];

  const contacts = await enumerateContactUsers();
  const master = await readMaster(baseToken);
  const masterByOpenId = new Map<string, MasterRow>();
  let skippedNoOpenId = 0;
  for (const row of master) {
    if (row.openId) masterByOpenId.set(row.openId, row);
    else skippedNoOpenId++;
  }

  const toCreate: Record<string, any>[] = [];
  const toUpdate: { record_id: string; fields: Record<string, any> }[] = [];
  const toRetire: { record_id: string; fields: Record<string, any> }[] = [];
  const preview: SyncReport["preview"] = { create: [], update: [], retire: [] };

  // CREATE / UPDATE
  for (const [openId, u] of contacts) {
    const existing = masterByOpenId.get(openId);
    const fields = buildFields(u, u.isResigned);
    if (!existing) {
      toCreate.push(fields);
      if (preview.create.length < 50)
        preview.create.push({ openId, name: u.name, employeeNo: u.employeeNo });
    } else {
      const changed = diffFields(existing.fields, fields);
      if (Object.keys(changed).length > 0) {
        toUpdate.push({ record_id: existing.recordId, fields: changed });
        if (preview.update.length < 50)
          preview.update.push({ openId, name: u.name, changed: Object.keys(changed) });
      }
    }
  }

  // RETIRE: 「列挙非在籍」を退職候補とし、各 open_id の is_resigned を直接確認して
  //   is_resigned=true の確証がある人だけ退職フラグを立てる（可視範囲外の在籍者を誤退職させない）。
  const retireCandidates = master.filter(
    (row) => row.openId && !contacts.has(row.openId) && row.fields[F.retired] !== true
  );
  const resignedStatus = await resolveResignedStatus(retireCandidates.map((r) => r.openId));
  let retireUnresolved = 0;
  for (const row of retireCandidates) {
    const isResigned = resignedStatus.get(row.openId);
    if (isResigned === true) {
      toRetire.push({ record_id: row.recordId, fields: { [F.retired]: true } });
      if (preview.retire.length < 50)
        preview.retire.push({ openId: row.openId, name: textOf(row.fields[F.name]) });
    } else if (isResigned === undefined) {
      // Lark が応答せず(=可視範囲外 41050 等) 退職可否を判定できない → 触らない
      retireUnresolved++;
    }
    // isResigned === false は在籍中(可視範囲内)なので退職にしない
  }

  if (!dryRun) {
    try {
      if (toCreate.length) await batchCreateBaseRecords(EMP_TABLE_ID, toCreate, { baseToken });
    } catch (e: any) {
      errors.push(`create失敗: ${e?.message || e}`);
    }
    try {
      const updates = [...toUpdate, ...toRetire];
      if (updates.length) await batchUpdateBaseRecords(EMP_TABLE_ID, updates, { baseToken });
    } catch (e: any) {
      errors.push(`update失敗: ${e?.message || e}`);
    }
  }

  return {
    dryRun,
    contactCount: contacts.size,
    masterCount: master.length,
    created: toCreate.length,
    updated: toUpdate.length,
    retired: toRetire.length,
    retireUnresolved,
    skippedNoOpenId,
    errors,
    durationMs: Date.now() - startedAt,
    preview,
  };
}
