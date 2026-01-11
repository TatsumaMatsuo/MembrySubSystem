import { getBaseRecords } from "@/lib/lark-client";
import { getLarkTables, BAIYAKU_FIELDS } from "@/lib/lark-tables";
import type { BaiyakuInfo, SearchParams } from "@/types";

/**
 * 売約情報を検索
 */
export async function searchBaiyakuInfo(params: SearchParams): Promise<BaiyakuInfo[]> {
  const tables = getLarkTables();
  const filters: string[] = [];

  // 製番での部分一致検索 (FIND関数を使用)
  if (params.seiban) {
    filters.push(`FIND("${params.seiban}", CurrentValue.[${BAIYAKU_FIELDS.seiban}]) > 0`);
  }

  // 担当者での部分一致検索
  if (params.tantousha) {
    filters.push(`FIND("${params.tantousha}", CurrentValue.[${BAIYAKU_FIELDS.tantousha}]) > 0`);
  }

  // 案件名（品名+品名2）での部分一致検索
  if (params.anken_name) {
    filters.push(
      `OR(FIND("${params.anken_name}", CurrentValue.[${BAIYAKU_FIELDS.hinmei}]) > 0, FIND("${params.anken_name}", CurrentValue.[${BAIYAKU_FIELDS.hinmei2}]) > 0)`
    );
  }

  // 得意先名（得意先宛名1+得意先宛名2）での部分一致検索
  if (params.tokuisaki) {
    filters.push(
      `OR(FIND("${params.tokuisaki}", CurrentValue.[${BAIYAKU_FIELDS.tokuisaki_atena1}]) > 0, FIND("${params.tokuisaki}", CurrentValue.[${BAIYAKU_FIELDS.tokuisaki_atena2}]) > 0)`
    );
  }

  // 受注日From（テキスト型なので文字列比較）
  if (params.juchu_date_from) {
    filters.push(`CurrentValue.[${BAIYAKU_FIELDS.juchu_date}] >= "${params.juchu_date_from}"`);
  }

  // 受注日To（テキスト型なので文字列比較）
  if (params.juchu_date_to) {
    filters.push(`CurrentValue.[${BAIYAKU_FIELDS.juchu_date}] <= "${params.juchu_date_to}"`);
  }

  const filter = filters.length > 0 ? `AND(${filters.join(", ")})` : undefined;

  const response = await getBaseRecords(tables.BAIYAKU, {
    filter,
    // sort: [{ field_name: BAIYAKU_FIELDS.juchu_date, desc: true }],
    pageSize: 100,
  });

  if (!response.data?.items) {
    return [];
  }

  return response.data.items.map((item) => ({
    record_id: item.record_id || "",
    seiban: String(item.fields?.[BAIYAKU_FIELDS.seiban] || ""),
    hinmei: String(item.fields?.[BAIYAKU_FIELDS.hinmei] || ""),
    hinmei2: item.fields?.[BAIYAKU_FIELDS.hinmei2]
      ? String(item.fields[BAIYAKU_FIELDS.hinmei2])
      : undefined,
    tantousha: String(item.fields?.[BAIYAKU_FIELDS.tantousha] || ""),
    juchu_date: item.fields?.[BAIYAKU_FIELDS.juchu_date]
      ? String(item.fields[BAIYAKU_FIELDS.juchu_date])
      : undefined,
    juchu_kingaku: item.fields?.[BAIYAKU_FIELDS.juchu_kingaku] as number | undefined,
    sekou_start_date: item.fields?.[BAIYAKU_FIELDS.sekou_start_date] as number | undefined,
    tokuisaki_atena1: item.fields?.[BAIYAKU_FIELDS.tokuisaki_atena1]
      ? String(item.fields[BAIYAKU_FIELDS.tokuisaki_atena1])
      : undefined,
    tokuisaki_atena2: item.fields?.[BAIYAKU_FIELDS.tokuisaki_atena2]
      ? String(item.fields[BAIYAKU_FIELDS.tokuisaki_atena2])
      : undefined,
  }));
}

/**
 * 製番で売約情報を取得
 */
export async function getBaiyakuBySeiban(seiban: string): Promise<BaiyakuInfo | null> {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${BAIYAKU_FIELDS.seiban}] = "${seiban}"`;

  const response = await getBaseRecords(tables.BAIYAKU, { filter, pageSize: 1 });

  if (!response.data?.items || response.data.items.length === 0) {
    return null;
  }

  const item = response.data.items[0];
  return {
    record_id: item.record_id || "",
    seiban: String(item.fields?.[BAIYAKU_FIELDS.seiban] || ""),
    hinmei: String(item.fields?.[BAIYAKU_FIELDS.hinmei] || ""),
    hinmei2: item.fields?.[BAIYAKU_FIELDS.hinmei2]
      ? String(item.fields[BAIYAKU_FIELDS.hinmei2])
      : undefined,
    tantousha: String(item.fields?.[BAIYAKU_FIELDS.tantousha] || ""),
    juchu_date: item.fields?.[BAIYAKU_FIELDS.juchu_date]
      ? String(item.fields[BAIYAKU_FIELDS.juchu_date])
      : undefined,
    juchu_kingaku: item.fields?.[BAIYAKU_FIELDS.juchu_kingaku] as number | undefined,
    sekou_start_date: item.fields?.[BAIYAKU_FIELDS.sekou_start_date] as number | undefined,
  };
}
