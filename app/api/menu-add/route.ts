import { NextRequest, NextResponse } from "next/server";
import { getLarkClient, getLarkBaseTokenForMaster } from "@/lib/lark-client";

// テーブルID
const TABLE_MENU_DISPLAY = process.env.LARK_TABLE_MENU_DISPLAY || "";
const TABLE_FUNCTION_PLACEMENT = process.env.LARK_TABLE_FUNCTION_PLACEMENT || "";

export async function POST(request: NextRequest) {
  const client = getLarkClient();
  if (!client) {
    return NextResponse.json({ error: "Lark client not initialized" }, { status: 500 });
  }

  const baseToken = getLarkBaseTokenForMaster();

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "add-customer-request-menu") {
      // 顧客要求事項変更届メニューを追加
      const results = {
        menu: null as any,
        programs: [] as any[],
      };

      // 1. 第2階層メニュー「顧客要求事項変更届」を追加
      const menuResult = await client.bitable.appTableRecord.create({
        path: {
          app_token: baseToken,
          table_id: TABLE_MENU_DISPLAY,
        },
        data: {
          fields: {
            "メニューID": "M001-03",
            "メニュー名": "顧客要求事項変更届",
            "階層レベル": 2,
            "親メニューID": "M001",
            "表示順": 3,
            "アイコン": "FileText",
            "有効フラグ": true,
          },
        },
      });
      results.menu = menuResult.data?.record;
      console.log("[menu-add] Created menu:", results.menu?.record_id);

      // 2. プログラムを追加
      const programs = [
        {
          program_id: "PGM013",
          program_name: "納期変更",
          url_path: "/baiyaku/customer-request/nouki",
          sort_order: 1,
        },
        {
          program_id: "PGM014",
          program_name: "仕様変更・金額変更",
          url_path: "/baiyaku/customer-request/shiyou",
          sort_order: 2,
        },
        {
          program_id: "PGM015",
          program_name: "金額変更・請求依頼",
          url_path: "/baiyaku/customer-request/kingaku",
          sort_order: 3,
        },
        {
          program_id: "PGM016",
          program_name: "手配依頼",
          url_path: "/baiyaku/customer-request/tehai",
          sort_order: 4,
        },
      ];

      for (const prog of programs) {
        const progResult = await client.bitable.appTableRecord.create({
          path: {
            app_token: baseToken,
            table_id: TABLE_FUNCTION_PLACEMENT,
          },
          data: {
            fields: {
              "プログラムID": prog.program_id,
              "プログラム名称": prog.program_name,
              "配置メニューID": "M001-03",
              "URLパス": prog.url_path,
              "表示順": prog.sort_order,
              "有効フラグ": true,
            },
          },
        });
        results.programs.push(progResult.data?.record);
        console.log(`[menu-add] Created program: ${prog.program_name}`);
      }

      return NextResponse.json({
        success: true,
        message: "顧客要求事項変更届メニューを追加しました",
        results,
      });
    }

    if (action === "add-design-request-program") {
      // 設計依頼プログラムを製造部メニューに追加
      const progResult = await client.bitable.appTableRecord.create({
        path: {
          app_token: baseToken,
          table_id: TABLE_FUNCTION_PLACEMENT,
        },
        data: {
          fields: {
            "プログラムID": "PGM017",
            "プログラム名称": "設計依頼",
            "配置メニューID": "M001-03", // 顧客要求事項変更届
            "URLパス": "/customer-request/sekeiirai",
            "表示順": 5,
            "有効フラグ": true,
          },
        },
      });
      console.log(`[menu-add] Created program: 設計依頼 (PGM017)`);

      return NextResponse.json({
        success: true,
        message: "設計依頼プログラムを追加しました",
        result: progResult.data?.record,
      });
    }

    if (action === "update-design-request-url") {
      // 設計依頼のURLパスを更新
      const { recordId } = body;
      if (!recordId) {
        return NextResponse.json({ error: "recordId is required" }, { status: 400 });
      }

      const updateResult = await client.bitable.appTableRecord.update({
        path: {
          app_token: baseToken,
          table_id: TABLE_FUNCTION_PLACEMENT,
          record_id: recordId,
        },
        data: {
          fields: {
            "URLパス": "/customer-request/sekeiirai",
            "配置メニューID": "M001-03", // 顧客要求事項変更届
          },
        },
      });
      console.log(`[menu-add] Updated program URL: 設計依頼 (PGM017)`);

      return NextResponse.json({
        success: true,
        message: "設計依頼のURLパスを更新しました",
        result: updateResult.data?.record,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[menu-add] Error:", error);
    return NextResponse.json(
      { error: "メニュー追加に失敗しました", details: error.message },
      { status: 500 }
    );
  }
}
