import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireViewPermission } from "@/lib/syaryo/auth-utils";
import { getPermits } from "@/lib/syaryo/services/permit.service";

/**
 * GET /api/permits
 * 許可証一覧を取得
 * クエリパラメータ:
 * - employeeId: 社員IDでフィルター（オプション）
 * - status: ステータスでフィルター（オプション: valid, expired, revoked）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");

    // 権限チェック（employeeIdが指定されている場合は本人または管理者）
    if (employeeId) {
      const authCheck = await requireAuth();
      if (!authCheck.authorized) {
        return authCheck.response;
      }

      // 本人以外の場合は閲覧権限をチェック
      if (authCheck.userId !== employeeId) {
        const viewCheck = await requireViewPermission();
        if (!viewCheck.authorized) {
          return viewCheck.response;
        }
      }
    } else {
      // 全件取得は管理者のみ
      const viewCheck = await requireViewPermission();
      if (!viewCheck.authorized) {
        return viewCheck.response;
      }
    }

    // 許可証一覧を取得
    let permits = await getPermits(employeeId || undefined);

    // ステータスでフィルター
    if (status) {
      permits = permits.filter((p) => p.status === status);
    }

    // 発行日の降順でソート
    permits.sort((a, b) => b.issue_date.getTime() - a.issue_date.getTime());

    return NextResponse.json({
      success: true,
      permits,
      count: permits.length,
    });
  } catch (error) {
    console.error("許可証一覧取得エラー:", error);
    return NextResponse.json(
      { success: false, error: "許可証一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
