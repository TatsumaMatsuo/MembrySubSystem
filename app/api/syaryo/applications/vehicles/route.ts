import { NextRequest, NextResponse } from "next/server";
import {
  getVehicleRegistrations,
  createVehicleRegistration,
} from "@/lib/syaryo/services/vehicle-registration.service";

/**
 * GET /api/applications/vehicles
 * 車検証一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId") || undefined;

    const vehicles = await getVehicleRegistrations(employeeId);

    return NextResponse.json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    console.error("Error in GET /api/applications/vehicles:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch vehicle registrations",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/vehicles
 * 車検証を新規作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log(`[vehicles API] Creating vehicle with employee_id: ${body.employee_id}`);

    const vehicle = await createVehicleRegistration({
      employee_id: body.employee_id,
      vehicle_number: body.vehicle_number,
      vehicle_type: body.vehicle_type,
      manufacturer: body.manufacturer,
      model_name: body.model_name,
      inspection_expiration_date: new Date(body.inspection_expiration_date),
      owner_name: body.owner_name,
      image_attachment: body.image_attachment || null,
      status: "temporary",
      approval_status: "pending",
      deleted_flag: false,
    });

    return NextResponse.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error("Error in POST /api/applications/vehicles:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create vehicle registration",
      },
      { status: 500 }
    );
  }
}
