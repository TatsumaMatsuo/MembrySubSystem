import { NextRequest, NextResponse } from "next/server";
import { getEmployees } from "@/services/employee.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;

    const employees = await getEmployees(search);

    return NextResponse.json({
      success: true,
      data: employees,
      total: employees.length,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "社員マスタの取得に失敗しました",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
