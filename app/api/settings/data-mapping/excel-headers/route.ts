import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// POST: Excelファイルから1行目（ヘッダー）を取得
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    // ファイルタイプチェック
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Excelファイル（.xlsx, .xls）を選択してください" },
        { status: 400 }
      );
    }

    // Excelファイルを読み込み
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // 最初のシートを取得
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // シートの範囲を取得
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

    // 1行目のセルからヘッダーを抽出
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== "") {
        headers.push(String(cell.v).trim());
      }
    }

    // 空のヘッダーを除外
    const validHeaders = headers.filter((h) => h.length > 0);

    return NextResponse.json({
      fileName: file.name,
      sheetName,
      headers: validHeaders,
      totalColumns: validHeaders.length,
    });
  } catch (error: any) {
    console.error("[excel-headers] Error:", error);
    return NextResponse.json(
      { error: "Excelファイルの解析に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
