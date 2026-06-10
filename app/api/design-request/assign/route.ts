/**
 * 設計依頼担当者割り当てAPI
 * Issue #29: 設計部メニュー - 課員への割振り機能
 */
import { NextRequest, NextResponse } from "next/server";
import { updateBaseRecord } from "@/lib/lark-client";
import {
  DESIGN_REQUEST_BASE_TOKEN,
  DESIGN_REQUEST_TABLE_ID,
  DESIGN_REQUEST_FIELDS,
} from "@/lib/design-request-tables";

/**
 * 担当者を割り当てる
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, assigneeId, assigneeName, assigneeEmail } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "recordIdは必須です" },
        { status: 400 }
      );
    }

    if (!assigneeId) {
      return NextResponse.json(
        { success: false, error: "assigneeIdは必須です" },
        { status: 400 }
      );
    }

    console.log("[design-request/assign] Assigning:", {
      recordId,
      assigneeId,
      assigneeName,
    });

    // Larkユーザー形式で担当者を更新
    const updateFields = {
      [DESIGN_REQUEST_FIELDS.tantousha]: [
        {
          id: assigneeId,
          ...(assigneeName && { name: assigneeName }),
          ...(assigneeEmail && { email: assigneeEmail }),
        },
      ],
    };

    const response = await updateBaseRecord(
      DESIGN_REQUEST_TABLE_ID,
      recordId,
      updateFields,
      { baseToken: DESIGN_REQUEST_BASE_TOKEN }
    );

    if (response.code !== 0) {
      console.error("[design-request/assign] Error:", response.msg);
      return NextResponse.json(
        { success: false, error: response.msg },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        assignee: {
          id: assigneeId,
          name: assigneeName,
          email: assigneeEmail,
        },
      },
    });
  } catch (error) {
    console.error("[design-request/assign] Error:", error);
    return NextResponse.json(
      { success: false, error: "担当者の割り当てに失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * 作業区分を更新する
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, sagyouKubun, taiouBi } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "recordIdは必須です" },
        { status: 400 }
      );
    }

    console.log("[design-request/assign] Updating status:", {
      recordId,
      sagyouKubun,
      taiouBi,
    });

    const updateFields: Record<string, any> = {};

    if (sagyouKubun) {
      updateFields[DESIGN_REQUEST_FIELDS.sagyou_kubun] = sagyouKubun;
    }

    if (taiouBi) {
      updateFields[DESIGN_REQUEST_FIELDS.taiou_bi] = new Date(taiouBi).getTime();
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, error: "更新するフィールドがありません" },
        { status: 400 }
      );
    }

    const response = await updateBaseRecord(
      DESIGN_REQUEST_TABLE_ID,
      recordId,
      updateFields,
      { baseToken: DESIGN_REQUEST_BASE_TOKEN }
    );

    if (response.code !== 0) {
      console.error("[design-request/assign] Error:", response.msg);
      return NextResponse.json(
        { success: false, error: response.msg },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        recordId,
        updated: updateFields,
      },
    });
  } catch (error) {
    console.error("[design-request/assign] Error:", error);
    return NextResponse.json(
      { success: false, error: "ステータスの更新に失敗しました" },
      { status: 500 }
    );
  }
}
