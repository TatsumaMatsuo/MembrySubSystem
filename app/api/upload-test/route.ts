import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log("[upload-test] POST request received");
  console.log("[upload-test] Headers:", Object.fromEntries(request.headers.entries()));

  try {
    const contentType = request.headers.get("content-type") || "";
    console.log("[upload-test] Content-Type:", contentType);

    if (contentType.includes("application/json")) {
      const body = await request.json();
      console.log("[upload-test] JSON body keys:", Object.keys(body));
      console.log("[upload-test] Body size estimate:", JSON.stringify(body).length);

      return NextResponse.json({
        success: true,
        message: "Upload test received",
        bodyKeys: Object.keys(body),
        hasFileData: !!body.fileData,
        fileDataLength: body.fileData?.length || 0,
      });
    } else {
      const text = await request.text();
      console.log("[upload-test] Text body length:", text.length);

      return NextResponse.json({
        success: true,
        message: "Upload test received (non-JSON)",
        bodyLength: text.length,
      });
    }
  } catch (error) {
    console.error("[upload-test] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function GET() {
  console.log("[upload-test] GET request received");
  return NextResponse.json({ success: true, message: "Upload test endpoint is working" });
}
