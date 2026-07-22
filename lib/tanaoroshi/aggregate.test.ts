import { describe, it, expect } from "vitest";
import { computeDiffs, formatStateBreakdown, pickConfirmedQty, type ActualAgg, type StockInfo } from "./aggregate";

const A = (qty: number, extra: Partial<ActualAgg> = {}): ActualAgg => ({
  qty,
  itemName: "品名",
  states: { 良品: qty },
  ...extra,
});
const S = (systemQty: number): StockInfo => ({ systemQty, itemName: "品名", spec: "規格" });

describe("formatStateBreakdown", () => {
  it("0件を除いて整形", () => {
    expect(formatStateBreakdown({ 良品: 20, 不良品: 4, 滞留: 0 })).toBe("良品 20 / 不良品 4");
  });
  it("空", () => {
    expect(formatStateBreakdown({})).toBe("");
  });
});

describe("computeDiffs", () => {
  it("一致は差分に出ない", () => {
    const rows = computeDiffs(new Map([["F00001", A(10)]]), new Map([["F00001", S(10)]]), 1);
    expect(rows).toEqual([]);
  });

  it("実棚が多い→プラス差分", () => {
    const rows = computeDiffs(new Map([["F00001", A(12)]]), new Map([["F00001", S(10)]]), 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ itemCode: "F00001", systemQty: 10, actualQty: 12, diffQty: 2 });
  });

  it("システム在庫あり・報告なし→実棚0で差分（マイナス）", () => {
    const rows = computeDiffs(new Map(), new Map([["F00001", S(5)]]), 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actualQty: 0, systemQty: 5, diffQty: -5 });
  });

  it("実棚あり・システム在庫なし→差分（差分数=実棚）", () => {
    const rows = computeDiffs(new Map([["X99999", A(3)]]), new Map(), 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actualQty: 3, systemQty: 0, diffQty: 3 });
  });

  it("在庫状態内訳と理由コードを反映", () => {
    const rows = computeDiffs(
      new Map([["F00001", { qty: 24, itemName: "鉄板", states: { 良品: 20, 不良品: 4 }, reasonCode: "R03" }]]),
      new Map([["F00001", S(30)]]),
      2
    );
    expect(rows[0].stateBreakdown).toBe("良品 20 / 不良品 4");
    expect(rows[0].reasonCode).toBe("R03");
    expect(rows[0].round).toBe(2);
  });

  it("品番順にソート", () => {
    const rows = computeDiffs(
      new Map([
        ["F00003", A(1)],
        ["F00001", A(1)],
      ]),
      new Map([
        ["F00003", S(0)],
        ["F00001", S(0)],
      ]),
      1
    );
    expect(rows.map((r) => r.itemCode)).toEqual(["F00001", "F00003"]);
  });
});

describe("pickConfirmedQty", () => {
  it("最大回数の値を採用", () => {
    const v = pickConfirmedQty([
      { round: 1, qty: 10, staff: "a" },
      { round: 2, qty: 8, staff: "b" },
    ]);
    expect(v).toMatchObject({ round: 2, qty: 8 });
  });
  it("空は null", () => {
    expect(pickConfirmedQty([])).toBeNull();
  });
  it("1回のみ", () => {
    expect(pickConfirmedQty([{ round: 1, qty: 5, staff: "a" }])).toMatchObject({ round: 1, qty: 5 });
  });
});
