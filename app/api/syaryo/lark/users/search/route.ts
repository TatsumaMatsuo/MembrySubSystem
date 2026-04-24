import { NextRequest, NextResponse } from "next/server";
import { searchLarkUsers } from "@/lib/syaryo/services/lark-user.service";

/**
 * GET /api/lark/users/search
 * Larkユーザーを検索
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const users = await searchLarkUsers(query);

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error in GET /api/lark/users/search:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search users",
      },
      { status: 500 }
    );
  }
}
