import { NextRequest, NextResponse } from "next/server";
import { getDepartments, listAllDepartments, getGroups } from "@/lib/lark-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/lark/groups
 * Larkの部門・グループ一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "departments"; // "departments" or "groups"

    if (type === "groups") {
      // ユーザーグループを取得
      const response = await getGroups();

      if (response.code !== 0) {
        return NextResponse.json(
          { success: false, error: response.msg || "グループの取得に失敗しました" },
          { status: 500 }
        );
      }

      const groups = (response.data?.grouplist || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        member_count: g.member_count,
      }));

      return NextResponse.json({
        success: true,
        data: groups,
      });
    } else {
      // 部門一覧を取得（デフォルト）
      // まずchildrenメソッドを試す
      const parentId = searchParams.get("parent_id") || undefined;
      let response = await getDepartments(parentId);

      // childrenで取得できない場合はlistメソッドを試す
      if (response.code !== 0 || !response.data?.items?.length) {
        console.log("[lark/groups] children failed, trying list method...");
        response = await listAllDepartments();
      }

      if (response.code !== 0) {
        return NextResponse.json(
          {
            success: false,
            error: (response as any).msg || "部門の取得に失敗しました",
            code: response.code,
          },
          { status: 500 }
        );
      }

      const departments = (response.data?.items || []).map((d: any) => ({
        id: d.open_department_id || d.department_id,
        name: d.name,
        parent_id: d.parent_department_id,
        member_count: d.member_count,
        has_child: d.has_child,
      }));

      return NextResponse.json({
        success: true,
        data: departments,
      });
    }
  } catch (error) {
    console.error("[lark/groups] Error:", error);
    return NextResponse.json(
      { success: false, error: "Larkグループの取得に失敗しました", details: String(error) },
      { status: 500 }
    );
  }
}
