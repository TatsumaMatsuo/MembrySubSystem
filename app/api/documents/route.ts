import { NextRequest, NextResponse } from "next/server";
import { getDocumentsBySeiban, groupDocumentsByDepartment } from "@/services/documents.service";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seiban = searchParams.get("seiban");

    if (!seiban) {
      return NextResponse.json(
        { success: false, error: "製番は必須です" },
        { status: 400 }
      );
    }

    const documents = await getDocumentsBySeiban(seiban);
    const grouped = groupDocumentsByDepartment(documents);

    return NextResponse.json({
      success: true,
      data: grouped,
      raw: documents,
      total: documents.length,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { success: false, error: "データ取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
