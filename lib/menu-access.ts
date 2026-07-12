import { NextResponse } from "next/server";
import { resolveKpiUser, KpiUser, KPI_PROGRAMS } from "@/lib/kpi-permission";
import { getFunctionPlacementMaster } from "@/lib/menu-permission";

/**
 * 画面URL単位のメニュー権限をサーバ側で強制するガード。
 *
 * 設計意図(識学/権限モデル): 「グループ/個人のメニュー権限で表示制御し、表示できる＝編集可能」。
 * ただしメニュー権限はクライアント側(メニュー非表示)でしか効いていないため、API を直接叩けば
 * 迂回できてしまう。本ガードは同じメニュー権限を**サーバ側でも**強制する。
 *
 * program_id は機能配置マスタ(MS_SYS機能配置マスタ)が頻繁に変わるためハードコードせず、
 * **実行時に url_path → program_id を解決**してマスタ変更へ自動追従する。API 側は安定的な
 * 画面URL(例 "/eigyo/company-kpi")だけを持てばよい。
 *
 * 読取(GET)は制限しない設計(kpi-permission と同方針)。書込(POST/PUT/PATCH/DELETE)で使う。
 */

// 機能配置マスタ(url_path→program_id[])の短期キャッシュ。
// マスタは頻繁に変わるため短め(60秒)にして追従性と負荷を両立。
let _placementCache: { at: number; byUrl: Map<string, string[]> } | null = null;
const PLACEMENT_TTL_MS = 60 * 1000;

// テスト容易性のため注入不要の素朴な now()。Date.now は SSR ランタイムで利用可。
async function getProgramIdsForUrl(urlPath: string): Promise<string[]> {
  const now = Date.now();
  if (!_placementCache || now - _placementCache.at > PLACEMENT_TTL_MS) {
    const programs = await getFunctionPlacementMaster();
    const byUrl = new Map<string, string[]>();
    for (const p of programs) {
      const u = (p.url_path || "").trim();
      if (!u || !p.program_id) continue;
      const arr = byUrl.get(u) || [];
      arr.push(p.program_id);
      byUrl.set(u, arr);
    }
    _placementCache = { at: now, byUrl };
  }
  return _placementCache.byUrl.get(urlPath.trim()) || [];
}

export interface MenuAccessResult {
  authorized: boolean;
  user: KpiUser | null;
  /** 不許可時に API がそのまま返すレスポンス */
  response: NextResponse;
}

const deny = (user: KpiUser | null, status: number, error: string): MenuAccessResult => ({
  authorized: false,
  user,
  response: NextResponse.json({ error }, { status }),
});

/**
 * 指定した画面URLのメニュー権限を要求する。
 * - 未ログイン/社員未登録 → 401
 * - そのURLに紐づくプログラム権限が未許可/明示拒否 → 403
 * - マスタにそのURLの機能が無い場合は fail-closed(管理者=PGM040のみ許可)
 * 許可時は user を返す(operator 名等に利用)。
 */
export async function requireMenuAccess(urlPath: string): Promise<MenuAccessResult> {
  let user: KpiUser | null = null;
  try {
    user = await resolveKpiUser();
  } catch (e: any) {
    console.error("[menu-access] resolveKpiUser failed:", e);
    return {
      authorized: false,
      user: null,
      response: NextResponse.json(
        { error: `権限の確認に失敗しました: ${e?.message ?? e}`, step: "resolveKpiUser" },
        { status: 500 }
      ),
    };
  }
  if (!user) return deny(null, 401, "認証が必要です");

  const isAdmin =
    user.permittedPrograms.includes(KPI_PROGRAMS.SEISAN_MASTER) &&
    !user.deniedPrograms.includes(KPI_PROGRAMS.SEISAN_MASTER);

  let programIds: string[];
  try {
    programIds = await getProgramIdsForUrl(urlPath);
  } catch (e: any) {
    console.error("[menu-access] getProgramIdsForUrl failed:", e);
    return {
      authorized: false,
      user,
      response: NextResponse.json(
        { error: `権限の確認に失敗しました: ${e?.message ?? e}`, step: "placementMaster" },
        { status: 500 }
      ),
    };
  }

  // マスタにこのURLの機能定義が無い(孤立/未登録) → 管理者のみ許可(fail-closed)。
  if (programIds.length === 0) {
    return isAdmin
      ? { authorized: true, user, response: NextResponse.json({ ok: true }) }
      : deny(user, 403, "この操作を行う権限がありません(管理者にメニュー権限の付与を依頼してください)");
  }

  // マスタ管理者(PGM040)は全機能を許可。加えてそのURLのプログラム権限保持者を許可。
  const allowed =
    isAdmin ||
    programIds.some((pid) => user!.permittedPrograms.includes(pid) && !user!.deniedPrograms.includes(pid));

  if (!allowed) {
    return deny(user, 403, "この操作を行う権限がありません(管理者にメニュー権限の付与を依頼してください)");
  }
  return { authorized: true, user, response: NextResponse.json({ ok: true }) };
}
