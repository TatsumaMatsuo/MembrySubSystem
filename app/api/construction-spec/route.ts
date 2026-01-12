import { NextRequest, NextResponse } from "next/server";
import * as lark from "@larksuiteoapi/node-sdk";
import { getLarkTables } from "@/lib/lark-tables";
import type { ConstructionSpec } from "@/types";

// Larkクライアント初期化
const client = new lark.Client({
  appId: process.env.LARK_APP_ID || "",
  appSecret: process.env.LARK_APP_SECRET || "",
  disableTokenCache: false,
});

/**
 * 工事仕様書情報を取得するAPI
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const seiban = searchParams.get("seiban");

  if (!seiban) {
    return NextResponse.json(
      { success: false, error: "製番が指定されていません" },
      { status: 400 }
    );
  }

  try {
    const tables = getLarkTables();
    const baseToken = process.env.LARK_BASE_TOKEN || "";

    // 製番でフィルタリングしてレコードを検索
    const response = await client.bitable.appTableRecord.search({
      path: {
        app_token: baseToken,
        table_id: tables.CONSTRUCTION_SPEC,
      },
      params: {
        page_size: 1,
      },
      data: {
        filter: {
          conjunction: "and",
          conditions: [
            {
              field_name: "製番",
              operator: "is",
              value: [seiban],
            },
          ],
        },
      },
    });

    if (!response.data?.items || response.data.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "工事仕様書が見つかりません" },
        { status: 404 }
      );
    }

    const record = response.data.items[0];
    const fields = record.fields as Record<string, unknown>;

    // フィールドの値を安全に取得するヘルパー関数
    const getString = (fieldName: string): string => {
      const value = fields[fieldName];
      if (Array.isArray(value) && value.length > 0) {
        return value[0]?.text || String(value[0]) || "";
      }
      if (typeof value === "object" && value !== null && "text" in value) {
        return (value as { text: string }).text || "";
      }
      return String(value || "");
    };

    const getBoolean = (fieldName: string): boolean => {
      const value = fields[fieldName];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        return value === "有" || value === "必要" || value === "可" || value === "true";
      }
      return false;
    };

    const getNumber = (fieldName: string): number => {
      const value = fields[fieldName];
      if (typeof value === "number") return value;
      if (typeof value === "string") return parseInt(value, 10) || 0;
      return 0;
    };

    // 工事仕様書データを構築
    const constructionSpec: ConstructionSpec = {
      // 基本情報
      seiban: getString("製番") || seiban,
      seiban_name: getString("製番名") || getString("品名"),
      form_number: getString("フォーム番号"),
      issue_date: getString("発行日・版数"),
      created_date: getString("作成日"),
      sales_person: getString("営業担当者") || getString("担当者"),
      issue_department: getString("発行部署"),

      // 基礎工事
      foundation: {
        jurisdiction: getString("基礎工事所掌") || "所掌外",
        order_status: getString("基礎工事発注状況") || "未発注",
        order_destination: getString("基礎工事発注先"),
        foundation_type: getString("基礎工事種別") || "布基礎",
        floor_work: getBoolean("土間工事"),
        comment: getString("基礎工事コメント"),
      },

      // アンカー関連
      anchor: {
        bolt_jurisdiction: getString("アンカーボルト所掌") || "所掌",
        bolt_type: getString("ボルト種別") || "クロ",
        template_production: getBoolean("テンプレート製作"),
        template_count: getNumber("テンプレート製作枚数"),
        anchor_set_jurisdiction: getString("アンカーセット所掌") || "所掌外",
      },

      // 運搬・梱包
      transportation: {
        jurisdiction: getString("運搬梱包所掌") || "所掌",
        ten_ton_available: getBoolean("10t搬入可"),
        transport_method: getString("運搬方法") || "工事車両",
        ten_ton_count: getNumber("10t台数"),
        four_ton_count: getNumber("4t台数"),
        comment: getString("運搬コメント"),
      },

      // 現場施工
      site_construction: {
        jurisdiction: getString("現場施工所掌") || "所掌",
        existing_building_work: getBoolean("既設建物との取合工事"),
        crane_jurisdiction: getString("建て方重機所掌") || "所掌",
        crane_tonnage: getNumber("重機t数"),
        crane_count_per_day: getNumber("重機台数日"),
        crane_days: getNumber("重機日数"),
        crane_comment: getString("重機コメント"),
        work_vehicle_jurisdiction: getString("作業車所掌") || "所掌",
        work_vehicle_type: getString("作業車種別") || "12m",
        work_vehicle_count_per_day: getNumber("作業車台数日"),
        work_vehicle_days: getNumber("作業車日数"),
        work_vehicle_comment: getString("作業車コメント"),
      },

      // 現場環境
      site_environment: {
        vehicle_space: getBoolean("車両スペース"),
        heavy_equipment_space: getBoolean("重機設置スペース"),
        vehicle_space_comment: getString("車両スペースコメント"),
        obstacle: getBoolean("車両スペース障害物"),
        obstacle_comment: getString("障害物コメント"),
        power_available: getBoolean("電源の貸与"),
        power_comment: getString("電源コメント"),
        ground_condition: getString("地面状況") || "土間コン",
        ground_comment: getString("地面コメント"),
        entry_education: getBoolean("入場教育"),
        morning_meeting: getBoolean("朝礼"),
        morning_meeting_time: getString("朝礼時刻"),
        floor_exists: getBoolean("土間の有無"),
        floor_protection: getBoolean("土間養生"),
        floor_protection_area: getNumber("養生㎡数"),
        logo_required: getBoolean("ロゴマーク貼付"),
      },

      // 電気工事
      electrical: {
        jurisdiction: getString("電気工事所掌") || "所掌外",
        primary_work: getString("1次工事") || "所掌外",
        secondary_work: getString("2次工事") || "所掌外",
        lighting_work: getString("照明工事") || "所掌外",
        order_status: getString("電気工事発注状況") || "未発注",
        order_destination: getString("電気工事発注先"),
        comment: getString("電気工事コメント"),
      },

      // 消防設備
      fire_protection: {
        jurisdiction: getString("消防設備所掌") || "所掌外",
        order_status: getString("消防設備発注状況") || "未発注",
        order_destination: getString("消防設備発注先"),
        comment: getString("消防設備コメント"),
      },

      // 張替
      replacement: {
        previous_membrane: getString("張替前膜材"),
        previous_replacement_date: getString("前回張替日"),
      },

      // 特記事項
      special_notes: {
        production_notes: getString("製作について特記"),
        steel_frame_notes: getString("鉄骨製作について"),
        membrane_notes: getString("膜製作について"),
        plating_required: getBoolean("メッキ塗装"),
        membrane_type: getString("膜種類") || getString("膜仕様"),
        construction_notes: getString("施工について特記"),
        other_notes: getString("その他特記事項"),
      },

      // 準備品
      preparation: {
        items: getString("準備品"),
        comment: getString("準備品コメント"),
      },

      // 提出書類
      documents: {
        project_name: getString("工事名称"),
        confirmation_required: getBoolean("確認申請"),
        application_creation: getBoolean("申請書作成"),
        application_submission: getBoolean("申請書提出"),
        drawing_creation: getBoolean("申請図面作成"),
        calculation_creation: getBoolean("計算書作成"),
        fire_procedure_jurisdiction: getString("消防手続き所掌") || "所掌外",
        mill_sheet_required: getBoolean("ミルシート"),
        steel_required: getBoolean("鋼材"),
        raw_material_required: getBoolean("原反"),
        material_required: getBoolean("資材"),
        plating_test_report_required: getBoolean("メッキ試験報告書"),
        main_contractor: getString("元請け名"),
        designer: getString("設計者"),
        steel_frame_category: getBoolean("鉄骨製作区分"),
        steel_frame_manual: getBoolean("鉄骨製作要領書"),
        membrane_category: getBoolean("膜製作区分"),
        membrane_manual: getBoolean("膜製作要領書"),
        construction_manual: getBoolean("施工要領書"),
        construction_plan: getBoolean("施工計画書"),
        photo_required: getBoolean("工程写真"),
        steel_production_photo: getBoolean("鉄骨製作工程"),
        membrane_production_photo: getBoolean("膜製作工程"),
        site_construction_photo: getBoolean("現場施工工程"),
        constructor: getString("施工者"),
        factory_inspection: getBoolean("工場立会"),
        non_destructive: getBoolean("非破壊"),
        coating_thickness: getBoolean("塗装膜厚"),
        safety_documents: getBoolean("安全書類"),
        contract_type: getString("工事請負") || "下請け",
        subcontract_level: getNumber("請負何次"),
        work_category: getString("工事種別") || "建築一式",
        safety_document_format: getString("安全書類書式") || "グリーンファイル",
        submission_method: getString("提出方法") || "電子ファイル",
        submission_count: getNumber("提出部数"),
        submission_deadline: getString("提出期限"),
      },
    };

    return NextResponse.json({
      success: true,
      data: constructionSpec,
    });
  } catch (error) {
    console.error("Error fetching construction spec:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "工事仕様書の取得に失敗しました",
      },
      { status: 500 }
    );
  }
}
