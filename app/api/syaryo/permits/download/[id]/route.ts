import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireViewPermission, getCurrentEmployeeInfo } from "@/lib/syaryo/auth-utils";
import { getPermitById } from "@/lib/syaryo/services/permit.service";
import { readPermitPdf, generatePermitPdfBuffer } from "@/lib/syaryo/services/pdf-generator.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/permits/download/[id]
 * 許可証PDFをダウンロード
 * サーバーレス環境ではファイルシステムが永続化されないため、
 * ファイルが見つからない場合はオンデマンドでPDFを再生成する
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "許可証IDが必要です" },
        { status: 400 }
      );
    }

    // 認証チェックと許可証取得を並列実行
    const [authCheck, permit] = await Promise.all([
      requireAuth(),
      getPermitById(id),
    ]);

    if (!authCheck.authorized) {
      return authCheck.response;
    }

    if (!permit) {
      return NextResponse.json(
        { success: false, error: "許可証が見つかりません" },
        { status: 404 }
      );
    }

    // 本人の許可証以外は管理者(閲覧権限)のみDL可。任意IDで他人の許可証PDFをDLできたIDOR対策。
    const me = await getCurrentEmployeeInfo();
    if (permit.employee_id !== me?.employeeId) {
      const view = await requireViewPermission();
      if (!view.authorized) return view.response;
    }

    console.log(`[permit-download] Permit: ${permit.id}, employee: ${permit.employee_name}`);

    // PDFファイルを読み込む（まずローカルファイルを試す）
    let pdfBuffer = readPermitPdf(permit.permit_file_key);

    // ファイルが見つからない場合はオンデマンドで生成
    if (!pdfBuffer) {
      console.log(`[permit-download] PDF file not found, generating on-demand: ${permit.permit_file_key}`);

      // ベースURLを取得
      const baseUrl = process.env.NEXTAUTH_URL ||
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      console.log(`[permit-download] Using baseUrl: ${baseUrl}`);

      // 日付を確実に有効なDateオブジェクトに変換（Invalid Date対策）
      const parseDate = (dateValue: Date | string | number | undefined | null, fallback: Date): Date => {
        if (!dateValue) return fallback;
        const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
        // Invalid Dateチェック（isNaN(date.getTime())がtrueならInvalid Date）
        return isNaN(parsed.getTime()) ? fallback : parsed;
      };

      const now = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      const issueDate = parseDate(permit.issue_date, now);
      const expirationDate = parseDate(permit.expiration_date, oneYearLater);

      console.log(`[permit-download] Dates - issue: ${issueDate.toISOString()}, expiration: ${expirationDate.toISOString()}`);

      // verificationTokenが空の場合はpermitIdを使用
      const verificationToken = permit.verification_token || permit.id;

      // PDFを動的に生成
      try {
        pdfBuffer = await generatePermitPdfBuffer({
          employeeName: permit.employee_name || "Unknown",
          vehicleNumber: permit.vehicle_number || "Unknown",
          vehicleModel: permit.vehicle_model || `${permit.manufacturer || ''} ${permit.model_name || ''}`.trim() || "Unknown",
          issueDate,
          expirationDate,
          permitId: permit.id,
          verificationToken,
          baseUrl,
        });
        console.log(`[permit-download] PDF generated successfully, size: ${pdfBuffer.length} bytes`);
      } catch (pdfError) {
        console.error(`[permit-download] PDF generation failed:`, pdfError);
        throw pdfError;
      }
    }

    // ファイル名を生成
    const fileName = `permit_${permit.employee_name}_${permit.vehicle_number}.pdf`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[permit-download] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[permit-download] Error details:", { message: errorMessage, stack: errorStack });
    return NextResponse.json(
      { success: false, error: `許可証のダウンロードに失敗しました: ${errorMessage}` },
      { status: 500 }
    );
  }
}
