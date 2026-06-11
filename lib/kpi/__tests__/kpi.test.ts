/**
 * lib/kpi 回帰テスト
 *
 * 仕様の正本 = `50期生産本部KPIマスタ.xlsx`。
 * 判定はExcel `判定` 列の実値、基礎データ算出はExcel算出値で検証する。
 */
import { describe, it, expect } from "vitest";
import {
  aggregate,
  attainmentRate,
  judge,
  judgeFromMonths,
  grossProfitRate,
  materialRate,
  assetTurnover,
  monthlyStar,
  itemStars,
  deptTotalStars,
  yearEndBonus,
  autoEffect,
  aggregateGroup,
  isCumulative,
  midtermTrajectory,
  normalizeKaikei,
  fiscalMonthOf,
  type MonthlyActual,
  type BasisMonth,
  type StarItem,
} from "../index";

const months = (vals: (number | null)[]): MonthlyActual[] =>
  vals.map((v, i) => ({ fiscalMonth: i + 1, value: v }));

describe("aggregate", () => {
  it("累計は経過月内を合算", () => {
    expect(aggregate("累計", months([1, 2, 3, 4, null]), 4)).toBe(10);
  });
  it("平均は非nullの平均", () => {
    expect(aggregate("平均", months([2, 4, null, 6]), 4)).toBeCloseTo(4, 5);
  });
  it("直近月値は経過月内の最後の値", () => {
    expect(aggregate("直近月値", months([5, 6, 7, null]), 4)).toBe(7);
  });
});

describe("judge — Excel『判定』列の実値で回帰検証(50期/経過9ヶ月)", () => {
  const E = 9;
  // [name, aggType, direction, annualTarget, current, expected]
  const cases: [string, any, any, number, number, string][] = [
    ["M-03 クレーム", "累計", "少ない方が良い", 6, 5, "黄"],
    ["M-04 不具合", "累計", "少ない方が良い", 51, 31, "緑"],
    ["M-30 クレーム", "累計", "少ない方が良い", 1, 1, "赤"],
    ["M-31 不具合", "累計", "少ない方が良い", 9, 9, "赤"],
    ["M-33 生産量補助", "累計", "高い方が良い", 687.6, 451.1, "黄"],
    ["M-43 生産量補助", "累計", "高い方が良い", 216, 147.7, "黄"],
    ["M-101 不具合", "累計", "少ない方が良い", 5, 3, "緑"],
    ["M-103 値引額", "累計", "高い方が良い", 21000, 15556, "緑"],
    ["M-112 BN改善", "累計", "高い方が良い", 12, 7, "赤"],
    ["M-122 外注内不具合", "累計", "少ない方が良い", 120, 144, "赤"],
    ["M-16 鉄工生産量", "累計", "高い方が良い", 1505, 872.3, "赤"],
    ["M-18 労災", "累計", "少ない方が良い", 0, 0, "緑"],
    ["M-73 縫製生産量", "累計", "高い方が良い", 101100, 64073, "黄"],
    ["M-94 外注金額(少ない累計)", "累計", "少ない方が良い", 450000000, 408160059, "黄"],
    ["M-93 在庫(直近)", "直近月値", "少ない方が良い", 447000000, 668832492, "赤"],
    ["M-123 検査発見", "平均", "高い方が良い", 85, 97.933, "緑"],
    ["M-32 LT", "平均", "少ない方が良い", 9.2, 4.856, "緑"],
    ["M-35 生産効率", "平均", "高い方が良い", 25, 22.367, "黄"],
    ["M-85 生産効率", "平均", "高い方が良い", 7.8, 5.822, "赤"],
    ["M-113 納期変更率", "平均", "少ない方が良い", 11, 14.533, "赤"],
  ];
  it.each(cases)("%s → %s", (_n, agg, dir, target, current, expected) => {
    expect(judge({ aggType: agg, direction: dir, annualTarget: target }, current, E)).toBe(
      expected
    );
  });

  it("月次実績配列からの判定(M-30 累計少ない)", () => {
    // 本社鉄工課クレーム 8月-4月: 12月のみ1件、他0
    const m = months([0, 0, 0, 0, 1, 0, 0, 0, 0, null, null, null]);
    expect(judgeFromMonths({ aggType: "累計", direction: "少ない方が良い", annualTarget: 1 }, m, 9)).toBe("赤");
  });
});

describe("attainmentRate", () => {
  it("少ない方が良いで現在0は達成(Infinity)", () => {
    expect(attainmentRate({ aggType: "累計", direction: "少ない方が良い", annualTarget: 0 }, 0, 9)).toBe(Infinity);
  });
  it("M-03: 月割合算0.75×6=4.5 ÷ 5 = 0.9 → 黄域", () => {
    const r = attainmentRate({ aggType: "累計", direction: "少ない方が良い", annualTarget: 6 }, 5, 9);
    expect(r).toBeCloseTo(0.9, 3);
  });
});

describe("basis — 会計算出KPI(Excel 50期 経過8ヶ月)", () => {
  const rows: BasisMonth[] = [
    { fiscalMonth: 1, sales: 196.6, cost: 145.6, material: 89.7, assets: 5140.7 },
    { fiscalMonth: 2, sales: 449.9, cost: 376, material: 81.6, assets: 5376.7 },
    { fiscalMonth: 3, sales: 401.2, cost: 304.3, material: 86.9, assets: 5240.7 },
    { fiscalMonth: 4, sales: 195, cost: 154.1, material: 121.4, assets: 5376.9 },
    { fiscalMonth: 5, sales: 940, cost: 703.1, material: 98.4, assets: 5861.9 },
    { fiscalMonth: 6, sales: 297, cost: 195, material: 46.3, assets: 5514.4 },
    { fiscalMonth: 7, sales: 263.9, cost: 227.6, material: 67.9, assets: 5726 },
    { fiscalMonth: 8, sales: 1005.6, cost: 756.8, material: 91.3, assets: 5823.4 },
  ];
  it("粗利率 ≒ 23.65%(Excel 0.23650)", () => {
    expect(grossProfitRate(rows, 8)).toBeCloseTo(0.2365, 4);
  });
  it("材料金額比率 ≒ 23.88%(Excel 0.23877)", () => {
    expect(materialRate(rows, 8)).toBeCloseTo(0.23877, 4);
  });
  it("総資産回転率は正の値(年換算定義は要Excel確認)", () => {
    expect(assetTurnover(rows, 8)).toBeGreaterThan(0);
  });
});

describe("stars", () => {
  it("monthlyStar: 高い方=目標以上で★ / 少ない方=目標以下で★", () => {
    expect(monthlyStar({ monthlyTarget: 25, direction: "高い方が良い" }, 25)).toBe(true);
    expect(monthlyStar({ monthlyTarget: 25, direction: "高い方が良い" }, 24)).toBe(false);
    expect(monthlyStar({ monthlyTarget: 0, direction: "少ない方が良い" }, 0)).toBe(true);
    expect(monthlyStar({ monthlyTarget: 0, direction: "少ない方が良い" }, 1)).toBe(false);
  });
  it("間接部門特例: 経過月内の空欄も達成扱い", () => {
    expect(monthlyStar({ monthlyTarget: 0, direction: "少ない方が良い" }, null, true)).toBe(true);
    expect(monthlyStar({ monthlyTarget: 0, direction: "少ない方が良い" }, null, false)).toBe(false);
  });
  it("itemStars: 月間達成数を数える", () => {
    const item: StarItem = {
      monthlyTarget: 0,
      direction: "少ない方が良い",
      months: months([0, 0, 1, 0, null, null, null, null, null, null, null, null]),
    };
    // 経過4ヶ月: 0,0,1,0 → ★は8月,9月,11月 = 3
    expect(itemStars(item, 4)).toBe(3);
  });
  it("yearEndBonus: 年間目標達成項目ごとに+3", () => {
    const items: StarItem[] = [
      { monthlyTarget: 0, direction: "少ない方が良い", annualTarget: 6, months: months([1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]) }, // 累計3≤6 → +3
      { monthlyTarget: 0, direction: "少ない方が良い", annualTarget: 1, months: months([1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]) }, // 累計3>1 → 0
    ];
    expect(yearEndBonus(items)).toBe(3);
  });
  it("deptTotalStars: 自動★ + 期末ボーナス + 手入力", () => {
    const items: StarItem[] = [
      { monthlyTarget: 0, direction: "少ない方が良い", months: months([0, 0, 0, 0, null, null, null, null, null, null, null, null]) },
    ];
    // 経過4: 全て0 → 4★、期末未確定なのでボーナス0、手入力+3/-5
    const total = deptTotalStars({
      items,
      elapsed: 4,
      isPeriodClosed: false,
      adjustments: [{ delta: 3 }, { delta: -5 }],
    });
    expect(total).toBe(4 + 3 - 5);
  });
});

describe("effect — 施策効果の自動判定", () => {
  it("少ない方が良い: 5%以上改善で『改善』", () => {
    expect(autoEffect({ direction: "少ない方が良い", baseValue: 11, monthValue: 9 })).toBe("改善");
  });
  it("変化±5%以内は『横ばい』", () => {
    expect(autoEffect({ direction: "少ない方が良い", baseValue: 11, monthValue: 11 })).toBe("横ばい");
  });
  it("高い方が良い: 逆方向5%以上は『悪化』", () => {
    expect(autoEffect({ direction: "高い方が良い", baseValue: 20, monthValue: 18 })).toBe("悪化");
  });
  it("判定ランク上昇(赤→黄)は値が横ばいでも『改善』", () => {
    expect(
      autoEffect({ direction: "少ない方が良い", baseValue: 10, monthValue: 10, prevJudge: "赤", curJudge: "黄" })
    ).toBe("改善");
  });
});

describe("group — M:N集計", () => {
  it("累計は合算、平均は平均", () => {
    expect(isCumulative("累計")).toBe(true);
    expect(isCumulative("平均")).toBe(false);
    expect(aggregateGroup("累計", [5, 28, 14])).toBe(47);
    expect(aggregateGroup("平均", [21, 19, 23])).toBeCloseTo(21, 5);
  });
});

describe("midterm — 線形補間", () => {
  it("ROA 50→52期 8→13% = {50:8, 51:10.5, 52:13}", () => {
    const t = midtermTrajectory(50, 8, 52, 13);
    expect(t[50]).toBeCloseTo(8, 5);
    expect(t[51]).toBeCloseTo(10.5, 5);
    expect(t[52]).toBeCloseTo(13, 5);
  });
  it("売上 50→52期 55→67億 = {50:55, 51:61, 52:67}", () => {
    const t = midtermTrajectory(50, 55, 52, 67);
    expect(t[51]).toBeCloseTo(61, 5);
  });
});

describe("kaikei — 粒度正規化", () => {
  it("会計月序: 8月=1, 1月=6, 7月=12", () => {
    expect(fiscalMonthOf("2025-08")).toBe(1);
    expect(fiscalMonthOf("2026-01")).toBe(6);
    expect(fiscalMonthOf("2026-07")).toBe(12);
  });
  it("月別のみ → 合算", () => {
    expect(
      normalizeKaikei([
        { granularity: "月", period: "2025-08", value: 100 },
        { granularity: "月", period: "2025-09", value: 200 },
      ])
    ).toBe(300);
  });
  it("月別が無いレンジの四半期/半期のみ算入(重複しない)", () => {
    const total = normalizeKaikei([
      { granularity: "月", period: "2025-08", value: 100 }, // Q1(8-10)に月別あり
      { granularity: "四半期", period: "Q1", value: 999 }, // → 算入しない
      { granularity: "四半期", period: "Q2", value: 50 }, // Q2に月別なし → 算入
      { granularity: "半期", period: "下期", value: 70 }, // 下期(2-7月)に何もなし → 算入
    ]);
    expect(total).toBe(100 + 50 + 70);
  });
});
