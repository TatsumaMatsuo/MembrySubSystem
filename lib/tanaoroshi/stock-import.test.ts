import { describe, it, expect } from "vitest";
import {
  parseStockNumber,
  ymdToJstEpoch,
  validateStockHeader,
  validateStockRow,
  buildStockFields,
  STOCK_EXPECTED_HEADER,
} from "./stock-import";

describe("parseStockNumber", () => {
  it("カンマ区切り文字列を数値化する", () => {
    expect(parseStockNumber("75,480")).toBe(75480);
  });
  it("全角空白・空文字は null", () => {
    expect(parseStockNumber("　")).toBeNull();
    expect(parseStockNumber("")).toBeNull();
    expect(parseStockNumber(null)).toBeNull();
  });
  it("数値はそのまま", () => {
    expect(parseStockNumber(740)).toBe(740);
    expect(parseStockNumber("740")).toBe(740);
  });
  it("数値化できない文字列は null", () => {
    expect(parseStockNumber("abc")).toBeNull();
  });
  it("負数・小数も扱える", () => {
    expect(parseStockNumber("-3")).toBe(-3);
    expect(parseStockNumber("1.5")).toBe(1.5);
  });
});

describe("ymdToJstEpoch", () => {
  it("YYYY/MM/DD を JST真夜中のepochへ", () => {
    // 2026-06-30 JST 00:00 = 2026-06-29 15:00 UTC
    const ms = ymdToJstEpoch("2026/06/30");
    expect(ms).toBe(Date.UTC(2026, 5, 30) - 9 * 3600 * 1000);
    // JSTで戻すと日付が保たれる
    expect(new Date(ms! + 9 * 3600 * 1000).toISOString().slice(0, 10)).toBe("2026-06-30");
  });
  it("ハイフン区切りも許容", () => {
    expect(ymdToJstEpoch("2026-06-30")).toBe(ymdToJstEpoch("2026/06/30"));
  });
  it("不正な文字列は null", () => {
    expect(ymdToJstEpoch("　")).toBeNull();
    expect(ymdToJstEpoch("not-a-date")).toBeNull();
    expect(ymdToJstEpoch(null)).toBeNull();
  });
});

describe("validateStockHeader", () => {
  it("正しいヘッダーは問題なし", () => {
    expect(validateStockHeader([...STOCK_EXPECTED_HEADER])).toEqual([]);
  });
  it("前後空白は許容（trimして比較）", () => {
    const h = STOCK_EXPECTED_HEADER.map((c, i) => (i === 0 ? ` ${c} ` : c));
    expect(validateStockHeader(h)).toEqual([]);
  });
  it("列名が違えば検出", () => {
    const h: string[] = [...STOCK_EXPECTED_HEADER];
    h[4] = "商品番号";
    const issues = validateStockHeader(h);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain("品番");
  });
  it("列数不足を検出", () => {
    const issues = validateStockHeader(STOCK_EXPECTED_HEADER.slice(0, 40));
    expect(issues.some((m) => m.includes("列数"))).toBe(true);
  });
});

describe("validateStockRow", () => {
  const header = [...STOCK_EXPECTED_HEADER];
  const fullRow = () => {
    const r: any[] = new Array(header.length).fill("");
    r[header.indexOf("締日")] = "2026/06/30";
    r[header.indexOf("倉庫コード")] = 100;
    r[header.indexOf("倉庫")] = "本社 資材倉庫";
    r[header.indexOf("品番")] = "F00015";
    return r;
  };
  it("必須列が揃っていれば null", () => {
    expect(validateStockRow(header, fullRow(), 2)).toBeNull();
  });
  it("品番が空ならエラー", () => {
    const r = fullRow();
    r[header.indexOf("品番")] = "";
    expect(validateStockRow(header, r, 5)).toContain("品番");
  });
  it("全角空白のみの倉庫はエラー", () => {
    const r = fullRow();
    r[header.indexOf("倉庫")] = "　";
    expect(validateStockRow(header, r, 7)).toContain("倉庫");
  });
});

describe("buildStockFields", () => {
  const header = [...STOCK_EXPECTED_HEADER];
  const row = () => {
    const r: any[] = new Array(header.length).fill("");
    r[header.indexOf("締日")] = "2026/06/30";
    r[header.indexOf("倉庫コード")] = 100;
    r[header.indexOf("倉庫")] = "本社 資材倉庫";
    r[header.indexOf("品番")] = "F00015";
    r[header.indexOf("在庫数")] = "740"; // Text列: 文字列のまま
    r[header.indexOf("棚卸数")] = "5"; // Number列: 数値へ
    r[header.indexOf("在庫金額")] = "75,480"; // Text列: カンマ付き文字列のまま
    return r;
  };

  it("日付はepoch、数値列は数値、テキスト列は文字列", () => {
    const { fields, error } = buildStockFields(header, row());
    expect(error).toBeUndefined();
    expect(fields["締日"]).toBe(ymdToJstEpoch("2026/06/30"));
    expect(fields["倉庫コード"]).toBe(100); // Number列
    expect(fields["棚卸数"]).toBe(5); // Number列 → 数値化
    expect(fields["在庫数"]).toBe("740"); // Text列 → 文字列のまま
    expect(fields["在庫金額"]).toBe("75,480"); // Text列 → カンマ保持
  });

  it("空セルはキー自体をセットしない", () => {
    const { fields } = buildStockFields(header, row());
    expect(Object.prototype.hasOwnProperty.call(fields, "棚番")).toBe(false);
  });

  it("必須列が空なら error を返す", () => {
    const r = row();
    r[header.indexOf("品番")] = "";
    const { error } = buildStockFields(header, r);
    expect(error).toContain("品番");
  });
});
