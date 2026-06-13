import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import {
  getEmployeeByEmail,
  getEmployeeByLarkId,
  buildUserPermissions,
  expandDepartmentChain,
} from "@/lib/menu-permission";

/**
 * 生産本部KPI / 経営 のサーバ側 書込ガード(#59 §3.2)。
 *
 * 役職マスタを別途持たず、**既存のプログラム権限(メニュー権限マスタで付与)** を
 * そのまま「データ書込の認可ゲート」に再利用する。管理者がメニュー権限マスタ管理画面で
 * 各プログラムを部署/個人へ許可 → そのプログラムに紐づく書込APIを使えるようになる。
 *
 * プログラムID対応(register-kpi-menu.ts):
 *  PGM034 会計データ入力(本部長) / PGM035 中計マスタ(管理者)
 *  PGM037 KPI実績入力 / PGM038 施策管理 / PGM039 ★達成評価
 *  PGM040 マスタ管理(管理者)
 *
 * 読取(GET)は制限しない。書込(POST/PATCH)のみ本ガードを通す。
 */

export const KPI_PROGRAMS = {
  KEIEI_KAIKEI: "PGM034",
  KEIEI_MIDTERM: "PGM035",
  SEISAN_ACTUALS: "PGM037",
  SEISAN_MEASURES: "PGM038",
  SEISAN_STARS: "PGM039",
  SEISAN_MASTER: "PGM040",
  /** 期(会計年度)マスタ管理。経営/生産本部から独立した全社共通マスタ(PGM044) */
  KEIEI_PERIOD: "PGM044",
} as const;

export interface KpiUser {
  email: string | null;
  employeeId: string;
  employeeName: string;
  department: string;
  permittedPrograms: string[];
  deniedPrograms: string[];
}

/** セッション → 社員 → 許可プログラムを解決(未ログイン/未登録は null) */
export async function resolveKpiUser(): Promise<KpiUser | null> {
  const session = await getServerSession();
  if (!session?.user) return null;

  const email = session.user.email || null;
  const larkId = (session.user as any).id || null;

  let employee = email ? await getEmployeeByEmail(email) : null;
  if (!employee && larkId) employee = await getEmployeeByLarkId(larkId);
  if (!employee) return null;

  const groupChain = employee.department ? await expandDepartmentChain(employee.department) : [];
  const perms = await buildUserPermissions(employee.employeeId, employee.employeeName, groupChain);

  return {
    email,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    department: employee.department,
    permittedPrograms: perms.permitted_programs,
    deniedPrograms: perms.denied_programs,
  };
}

export interface GateResult {
  authorized: boolean;
  user: KpiUser | null;
  /** 不許可時に API がそのまま返すレスポンス */
  response: NextResponse;
}

/**
 * 指定プログラムの権限を要求する。
 * - 未ログイン/社員未登録 → 401
 * - プログラム未許可 or 明示拒否 → 403
 * 許可時は user を返す(operator 名等に利用)。
 */
export async function requireKpiProgram(programId: string): Promise<GateResult> {
  const user = await resolveKpiUser();
  if (!user) {
    return {
      authorized: false,
      user: null,
      response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }),
    };
  }
  const allowed = user.permittedPrograms.includes(programId) && !user.deniedPrograms.includes(programId);
  if (!allowed) {
    return {
      authorized: false,
      user,
      response: NextResponse.json(
        { error: "この操作を行う権限がありません(管理者にメニュー権限の付与を依頼してください)" },
        { status: 403 }
      ),
    };
  }
  return { authorized: true, user, response: NextResponse.json({ ok: true }) };
}
