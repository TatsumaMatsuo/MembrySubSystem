import { NextRequest, NextResponse } from "next/server";
import { getDriversLicenses, createDriversLicense } from "@/lib/syaryo/services/drivers-license.service";

/**
 * GET /api/applications/licenses
 * 免許証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId") || undefined;

    const licenses = await getDriversLicenses(employeeId);

    return NextResponse.json({
      success: true,
      data: licenses,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/licenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch drivers licenses",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/licenses
 * 免許証を新規作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const license = await createDriversLicense({
      employee_id: body.employee_id,
      license_number: body.license_number,
      license_type: body.license_type,
      issue_date: new Date(body.issue_date),
      expiration_date: new Date(body.expiration_date),
      image_attachment: body.image_attachment || null,
      image_attachment_ura: body.image_attachment_ura || null,
      status: "temporary",
      approval_status: "pending",
      deleted_flag: false,
    });

    return NextResponse.json({
      success: true,
      data: license,
    });
  } catch (error) {
    console.error("Error in POST /api/applications/licenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create drivers license",
      },
      { status: 500 }
    );
  }
}
