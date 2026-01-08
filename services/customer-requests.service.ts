import { getBaseRecords } from "@/lib/lark-client";
import { getLarkTables, CUSTOMER_REQUEST_FIELDS } from "@/lib/lark-tables";
import type { CustomerRequest } from "@/types";

/**
 * 製番に紐付く顧客要求事項変更履歴を取得
 */
export async function getCustomerRequestsBySeiban(seiban: string): Promise<CustomerRequest[]> {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${CUSTOMER_REQUEST_FIELDS.seiban}] = "${seiban}"`;

  const response = await getBaseRecords(tables.CUSTOMER_REQUESTS, {
    filter,
    // sort: [{ field_name: CUSTOMER_REQUEST_FIELDS.shinsei_date, desc: true }],
    pageSize: 100,
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    seiban: String(item.fields?.[CUSTOMER_REQUEST_FIELDS.seiban] || ""),
    shinsei_date: item.fields?.[CUSTOMER_REQUEST_FIELDS.shinsei_date] as number || 0,
    youkyuu_kubun: String(item.fields?.[CUSTOMER_REQUEST_FIELDS.youkyuu_kubun] || ""),
    honbun: String(item.fields?.[CUSTOMER_REQUEST_FIELDS.honbun] || ""),
  }));
}
