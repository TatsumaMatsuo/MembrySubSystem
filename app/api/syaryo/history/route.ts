import { NextRequest, NextResponse } from "next/server";
import { requireViewPermission } from "@/lib/syaryo/auth-utils";
import {
  getApprovalHistory,
  ApprovalHistoryFilter,
} from "@/lib/syaryo/services/approval-history.service";

/**
 * GET /api/history
 * 承認履歴を取得（閲覧権限以上）
 */
export async function GET(request: NextRequest) {
  // 閲覧権限チェック
  const authCheck = await requireViewPermission();
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const { searchParams } = new URL(request.url);

    // クエリパラメータを取得
    const filter: ApprovalHistoryFilter = {};

    const application_type = searchParams.get("application_type");
    if (application_type) {
      filter.application_type = application_type as "license" | "vehicle" | "insurance";
    }

    const employee_id = searchParams.get("employee_id");
    if (employee_id) {
      filter.employee_id = employee_id;
    }

    const approver_id = searchParams.get("approver_id");
    if (approver_id) {
      filter.approver_id = approver_id;
    }

    const action = searchParams.get("action");
    if (action) {
      filter.action = action as "approved" | "rejected";
    }

    // 承認履歴を取得
    const histories = await getApprovalHistory(filter);

    return NextResponse.json({
      success: true,
      data: histories,
      total: histories.length,
    });
  } catch (error) {
    console.error("Error in GET /api/history:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch approval history",
      },
      { status: 500 }
    );
  }
}
