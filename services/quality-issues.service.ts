import { getBaseRecords } from "@/lib/lark-client";
import { getLarkTables, QUALITY_ISSUE_FIELDS } from "@/lib/lark-tables";
import type { QualityIssue } from "@/types";

/**
 * 製番に紐付く品質改善リクエストを取得
 */
export async function getQualityIssuesBySeiban(seiban: string): Promise<QualityIssue[]> {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${QUALITY_ISSUE_FIELDS.seiban}] = "${seiban}"`;

  const response = await getBaseRecords(tables.QUALITY_ISSUES, {
    filter,
    // sort: [{ field_name: QUALITY_ISSUE_FIELDS.hassei_date, desc: true }],
    pageSize: 100,
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    seiban: String(item.fields?.[QUALITY_ISSUE_FIELDS.seiban] || ""),
    hassei_date: item.fields?.[QUALITY_ISSUE_FIELDS.hassei_date] as number || 0,
    hakken_busho: String(item.fields?.[QUALITY_ISSUE_FIELDS.hakken_busho] || ""),
    kiin_busho: String(item.fields?.[QUALITY_ISSUE_FIELDS.kiin_busho] || ""),
    fuguai_title: String(item.fields?.[QUALITY_ISSUE_FIELDS.fuguai_title] || ""),
    fuguai_honbun: String(item.fields?.[QUALITY_ISSUE_FIELDS.fuguai_honbun] || ""),
  }));
}
