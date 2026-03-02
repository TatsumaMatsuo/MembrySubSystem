/**
 * 担当者→営業所→地域 静的マッピング（PDF資料基準）
 */

export interface OfficeInfo {
  office: string;
  region: string;
}

/** 営業所の表示順序（PDFの表示順に準拠） */
export const OFFICE_ORDER = [
  "佐賀", "福岡", "北九州", "宮崎", "大阪",  // 西日本
  "名古屋", "東京", "北関東", "仙台",          // 東日本
] as const;

/** 地域の表示順序 */
export const REGION_ORDER = ["西日本", "東日本"] as const;

/** 営業所→地域マッピング */
export const OFFICE_REGION_MAP: Record<string, string> = {
  "佐賀": "西日本",
  "福岡": "西日本",
  "北九州": "西日本",
  "宮崎": "西日本",
  "大阪": "西日本",
  "名古屋": "東日本",
  "東京": "東日本",
  "北関東": "東日本",
  "仙台": "東日本",
};

/** 担当者名→営業所マッピング（PDF資料基準） */
const TANTOUSHA_OFFICE_MAP: Record<string, string> = {
  // 西日本 - 佐賀
  "山口篤樹": "佐賀",
  "野中一良": "佐賀",
  // 西日本 - 福岡
  "北原裕二": "福岡",
  "吉村一彦": "福岡",
  "小川智": "福岡",
  "宮地正義": "福岡",
  "富永健二": "福岡",
  "野田章善": "福岡",
  "若山典亮": "福岡",
  "山口秀樹": "福岡",
  // 西日本 - 北九州
  "小野克也": "北九州",
  "瀧澤宜規": "北九州",
  // 西日本 - 宮崎
  "宮脇智宏": "宮崎",
  // 西日本 - 大阪
  "山口大介": "大阪",
  "多田幸彦": "大阪",
  "井上鉄男": "大阪",
  // 東日本 - 名古屋
  "宍戸祐貴": "名古屋",
  // 東日本 - 東京
  "郷田哲雄": "東京",
  "浅野衛": "東京",
  "柴田美枝": "東京",
  // 東日本 - 北関東
  "西野拓磨": "北関東",
  "芦川努": "北関東",
  "内山英一郎": "北関東",
  // 東日本 - 仙台
  "山田新一郎": "仙台",
  "齋藤佑飛": "仙台",
};

/** 担当者名から営業所・地域情報を取得 */
export function getOfficeInfo(tantousha: string): OfficeInfo {
  const office = TANTOUSHA_OFFICE_MAP[tantousha];
  if (office) {
    return { office, region: OFFICE_REGION_MAP[office] || "その他" };
  }
  return { office: "その他", region: "その他" };
}

/** 営業所の表示順インデックスを取得（ソート用） */
export function getOfficeOrderIndex(office: string): number {
  const idx = (OFFICE_ORDER as readonly string[]).indexOf(office);
  return idx >= 0 ? idx : OFFICE_ORDER.length;
}

/** 責任区分の詳細理由→カテゴリマッピング */
export const REASON_TO_CATEGORY: Record<string, string> = {
  "施主要望": "社外",
  "元請要望": "社外",
  "行政指導": "社外",
  "営業対応": "自社",
  "設計対応": "自社",
  "製造対応": "自社",
  "施工対応": "自社",
  "その他": "自社",
  "納期確定": "納期確定",
  "確定": "納期確定",
  "社外": "社外",
  "自社": "自社",
};

/** 責任区分カテゴリ別の要因リスト（表示順） */
export const RESPONSIBILITY_REASONS: { category: string; reasons: string[] }[] = [
  { category: "社外", reasons: ["施主要望", "元請要望", "行政指導"] },
  { category: "自社", reasons: ["営業対応", "設計対応", "製造対応", "施工対応", "その他"] },
  { category: "納期確定", reasons: ["確定"] },
];
