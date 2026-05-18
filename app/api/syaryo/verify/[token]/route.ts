import { NextRequest, NextResponse } from "next/server";
import { getPermitByToken } from "@/lib/syaryo/services/permit.service";
import { isPermitValid, formatDate } from "@/lib/syaryo/permit-utils";

/**
 * GET /api/verify/[token]
 * QRコードから許可証の有効性を検証（認証不要）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          message: "検証トークンが必要です",
        },
        { status: 400 }
      );
    }

    // トークンから許可証を取得
    const permit = await getPermitByToken(token);

    if (!permit) {
      return NextResponse.json({
        valid: false,
        message: "許可証が見つかりません",
      });
    }

    // 有効性をチェック
    const valid = isPermitValid(permit);

    // ステータスに応じたメッセージ
    let message: string;
    if (permit.status === "revoked") {
      message = "この許可証は取り消されています";
    } else if (permit.status === "expired") {
      message = "この許可証は期限切れです";
    } else if (permit.expiration_date.getTime() < Date.now()) {
      message = "この許可証は期限切れです";
    } else {
      message = "有効な許可証です";
    }

    return NextResponse.json({
      valid,
      permit: {
        employee_name: permit.employee_name,
        vehicle_number: permit.vehicle_number,
        vehicle_model: permit.vehicle_model,
        issue_date: formatDate(permit.issue_date),
        expiration_date: formatDate(permit.expiration_date),
        status: permit.status,
      },
      message,
    });
  } catch (error) {
    console.error("許可証検証エラー:", error);
    return NextResponse.json(
      {
        valid: false,
        message: "検証中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
