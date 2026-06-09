# 04. API設計・判定/★算出ロジック

既存 `app/api/company-kpi/route.ts` 等の規約(`route.ts` + `parseRecord` + `lib/lark-client` の `getBaseRecords/createBaseRecord/updateBaseRecord`)を踏襲。

## 0. 共通方針

- ベースパス: `/api/seisan-kpi/*`
- 認証: 既存 `getServerSession()`(`lib/auth-server.ts`)でセッション取得 → ロール判定(`05_`)。
- レスポンス: `{ data, error }` 形式。Lark フィールドの配列/オブジェクト揺れは既存 `extractDepartmentName` / `isUriagezumi` 同様のヘルパで吸収。
- **算出は `lib/kpi/` の純関数**に集約し、API(サーバ)とページ(クライアント即時判定)で共有。

---

## 1. APIルート一覧

| メソッド | パス | 役割 |
|---------|------|------|
### 1.1 経営レイヤー(L0/L1)— `/api/keiei/*`(独立「経営」メニュー)

| メソッド | パス | 役割 |
|---------|------|------|
| GET | `/api/keiei/midterm?planId=MTP-1` | 中期経営計画(ヘッダ+明細)取得。複数中計対応 |
| POST/PATCH | `/api/keiei/midterm` | 中計の作成/編集(管理者)。**線形補間で明細自動生成** |
| GET | `/api/keiei/company-kpi?period=50` | 全社年度PL計画(既存 `COMPANY_KPI` 流用)取得 |
| GET/POST | `/api/keiei/kaikei-actual` | 会計データ実績(粒度=月/四半期/半期・本部長一括入力)取得/保存 |
| GET | `/api/keiei/dashboard?period=50` | 経営ダッシュボード集約(中計進捗+全社KPI進捗+会計入力状況) |

### 1.2 生産本部レイヤー(L2)— `/api/seisan-kpi/*`

| メソッド | パス | 役割 |
|---------|------|------|
| GET | `/api/seisan-kpi/master` | KPIマスタ取得(期フィルタ) |
| POST/PATCH | `/api/seisan-kpi/master` | KPI定義の作成/更新(管理者) |
| GET | `/api/seisan-kpi/periods` | 期マスタ取得 |
| POST | `/api/seisan-kpi/periods` | 期作成・経過月数更新(管理者) |
| GET | `/api/seisan-kpi/departments` | **Lark部署一覧**取得(部門ツリー。既存 `fetchLarkDepartmentTree` 流用) |
| GET/POST/PATCH | `/api/seisan-kpi/groups` | **グループマスタ**(GROUP)取得/編集 |
| GET/POST | `/api/seisan-kpi/groups/members` | **グループ所属(M:N)**(GROUP_MEMBER)取得/設定 |
| GET | `/api/seisan-kpi/actuals?period=50&dept=...` | 月次実績取得(部署単位・算出値付き) |
| POST | `/api/seisan-kpi/actuals` | 実績の保存(upsert)+ AUDIT |
| POST | `/api/seisan-kpi/actuals/lock` | 月次確定(ロック)/解除 |
| GET/POST/PATCH | `/api/seisan-kpi/measures?groupId=...` | 施策ヘッダ(**グループ単位**・状態/開始終了月)。件数無制限 |
| GET/POST/PATCH | `/api/seisan-kpi/pdca?measureId=...` | 月次PDCAログ(施策:PDCA=1:多)。効果は自動判定付き |
| GET/POST | `/api/seisan-kpi/stars?period=50` | ★達成(**部署ごと**算出)+ 手入力調整(STAR_ADJ) |
| GET | `/api/seisan-kpi/dashboard?period=50` | ダッシュボード集約(信号盤+★+要対応+施策進捗+トレンド) |
| GET | `/api/seisan-kpi/history?scope=zensha\|busho\|group&dept=...&groupId=...` | **過去実績(全社/部署別/グループ別 抽出)** |
| GET | `/api/seisan-kpi/export?type=...&format=csv\|pdf` | エクスポート |

> - `dashboard`/`keiei/dashboard` は複数テーブルを1リクエストに集約(画面遷移最小・504回避。既存の受注込タブ504対策の知見を流用)。
> - **会計データは1箇所(`/api/keiei/kaikei-actual`)で入力**し、生産本部Lv2(粗利率等)は同じ会計データを参照して算出(二重入力なし)。
> - 認証/認可は `getServerSession()` + KPIロール(`05_`)で全エンドポイント共通にガード。

---

## 2. `lib/kpi/` 算出ユーティリティ(純関数)

> **これが本システムの中核**。Excel(正本)の数式を移植し、ユニットテストで Excel 値と一致を検証する。

### 2.1 型定義(イメージ)

```ts
export type AggType = "累計" | "平均" | "直近月値" | "基礎データ算出";
export type Direction = "高い方が良い" | "少ない方が良い";
export type Judgment = "緑" | "黄" | "赤";

export interface KpiMaster {
  kpiId: string; aggType: AggType; direction: Direction;
  annualTarget: number; monthlyTarget: number; /* … */
}
export interface MonthlyActual { fiscalMonth: number; value: number | null; } // 1..12
```

### 2.2 集計(年累計/平均/直近月値)

```ts
// 集計タイプに応じた「現在値」を返す
function aggregate(agg: AggType, months: MonthlyActual[], elapsed: number): number {
  const vals = months.filter(m => m.fiscalMonth <= elapsed && m.value != null)
                     .map(m => m.value as number);
  switch (agg) {
    case "累計":     return sum(vals);
    case "平均":     return vals.length ? avg(vals) : 0;
    case "直近月値": return lastNonNull(months, elapsed); // 最新月の値
    case "基礎データ算出": throw new Error("BASIS から別途算出");
  }
}
```

### 2.3 進捗率(対比基準が型で異なる)

00_運用ガイド準拠。**経過月数 `elapsed` を分母基準に使う**点が要諦。

| 型/方向 | 対比基準(目標側) | 進捗率の意味 |
|---------|------------------|--------------|
| 累計・少ない方が良い | 経過月の月割目標合算(=月次目標×elapsed) | 実績累計 ÷ 月割合算(低いほど良い) |
| 累計・高い方が良い | 月割合算(年間目標 ÷12 × elapsed) | 実績累計 ÷ 月割合算 |
| 平均 | 年間/月次目標 | 実績平均 ÷ 目標(方向で良否反転) |
| 直近月値・少ない方が良い | 年間目標(=上限) | 実績 ÷ 目標 |
| 外注金額(累計・少ない) | 月割合算 | 実績累計 ÷ 月割合算 |

> ⚠️ Excel の `進捗率` 列の値(例: M-30 で 1.333、M-93 で 0.668)を**テストケースの期待値**として全63指標分を固定し、移植関数が一致することを保証する。

### 2.4 判定(緑/黄/赤)

```ts
function judge(master: KpiMaster, current: number, elapsed: number): Judgment {
  // 型 × 方向で分岐。閾値は 00_運用ガイドの表を実装。
  // 例: 少ない方が良い(累計) → 月割合算(target*elapsed)に対し
  //   実績 <= 合算        → 緑
  //   実績 <= 合算*1.5    → 黄
  //   実績 >  合算*1.5    → 赤
  // 例: 高い方が良い・平均 → 目標に対し
  //   実績 >= 目標        → 緑
  //   実績 >= 目標*0.95   → 黄
  //   else               → 赤
  // 直近月値/外注は専用閾値(§01 §5.1 の表)
}
```

> 判定の**正本は Excel**。実装は表をそのままコード化し、Excel の `判定` 列(全63件)と突合する回帰テストを置く。要件 §5.2 の簡易版(95/80)は説明用で、実装は運用ガイドの型別閾値を採用。

### 2.5 基礎データ算出KPI

```ts
// 粗利率 = Σ(売上高 − 製造原価) / Σ売上高   (累計ベース)
function grossProfitRate(basis: Basis[]): number { /* … */ }
// 総資産回転率 = 売上高(年換算= 累計/elapsed*12) / 直近総資産
function assetTurnover(basis: Basis[], elapsed: number): number { /* … */ }
// 材料金額比率 = Σ材料金額 / Σ製造原価
function materialRate(basis: Basis[]): number { /* … */ }
```

### 2.6 ★算出

```ts
// 月間★: その月の実績が月間目標を満たせば★
function monthlyStar(master, monthValue): boolean { /* 方向で比較 */ }
// 部署合計★ = Σ(対象項目×各月の月間★) + 期末ボーナス + 手入力調整
function deptStars(items, actuals, period, adjustments): number {
  const auto = sumMonthlyStars(items, actuals, period.elapsed);
  const yearEnd = period.isClosed ? yearEndBonus(items, actuals) : 0; // 年間達成で +3/項目
  const manual = sum(adjustments.map(a => a.delta)); // 5S/労災
  return auto + yearEnd + manual;
}
```

- 間接部門の特例(経過月内の空欄も達成扱い)は `monthlyStar` にフラグで対応。
- ★対象項目は部署ごとに固定(品質クレーム/品質不具合/納期LT/原価生産効率 等)→ 設定として保持(MASTER のフラグ or 別設定)。
- **★は部署ごと(確定)**。グループ集約ではなく Lark部署単位で算出。

### 2.7 施策の効果 自動判定(改善/横ばい/悪化)

`02_data-model.md` §2.6 の基準を実装。対象KPI実績の変化と方向から効果を提示。

```ts
// 基準値(施策開始時) or 前月 を基準に、対象KPIの良い方向で評価
function autoEffect(master: KpiMaster, baseValue: number, monthValue: number,
                    prevJudge: Judgment, curJudge: Judgment): "改善"|"横ばい"|"悪化" {
  const better = master.direction === "高い方が良い"
    ? (monthValue - baseValue) / baseValue
    : (baseValue - monthValue) / baseValue;          // 良い方向の変化率
  const rankUp = rankOf(curJudge) > rankOf(prevJudge);   // 赤<黄<緑
  const rankDown = rankOf(curJudge) < rankOf(prevJudge);
  if (better >= 0.05 || rankUp)  return "改善";
  if (better <= -0.05 || rankDown) return "悪化";
  return "横ばい";
}
```

> 閾値5%はパラメータ化。比較基準(基準値/前月)は画面オプション。**自動判定は目安**で、責任者が `効果_Check` を確定(手動上書き可)。

### 2.8 グループ集計(M:N)

グループは所属部署(`GROUP_MEMBER`)の値を集計するレンズ。北関東鉄工課のような重複所属は各グループで重複計上(表示)。

```ts
// グループの所属部署を取得 → 集計タイプで合算/平均
function aggregateGroup(groupId: string, kpiName: string, period: number) {
  const depts = getGroupMembers(groupId, period);       // M:N 解決
  const series = depts.map(d => getDeptKpi(d, kpiName, period));
  // 累計/件数系 → 合算、率/平均系 → 平均(KPIの集計タイプで分岐)
  return isCumulative(kpiName) ? sum(series) : avg(series);
}
```

### 2.9 中計トラジェクトリ(線形補間)

```ts
// 起点(開始期の値) → 終点(終了期のKGI)を直線按分。各期は個別上書き可。
function midtermTrajectory(startPeriod, startValue, endPeriod, endTarget): Record<number, number> {
  const out = {}; const span = endPeriod - startPeriod;
  for (let p = startPeriod; p <= endPeriod; p++) {
    out[p] = startValue + (endTarget - startValue) * (p - startPeriod) / span;
  }
  return out; // 例: 50→52期 ROA 8→13% なら {50:8, 51:10.5, 52:13}
}
```

### 2.10 会計データの粒度正規化

```ts
// 月/四半期/半期 の混在を年度累計に正規化。月別があれば四半期/半期は自動集計。
function normalizeKaikei(rows: KaikeiActual[], elapsed: number) { /* 粒度→累計 */ }
```

### 2.11 過去実績の抽出スコープ

```ts
// scope: 全社/部署別/グループ別
function history(scope, params) {
  if (scope === "zensha") return historyAggregate(params.indicator);          // HISTORY(集約)
  if (scope === "busho")  return deptHistory(params.dept);                      // ACTUAL(50期〜)+HISTORY(部署分)
  if (scope === "group")  return groupMembers(params.groupId).map(deptHistory); // 合算/平均
}
```

---

## 3. リクエスト/レスポンス例

### GET `/api/seisan-kpi/actuals?period=50&dept=本社鉄工課`

```jsonc
{
  "data": {
    "period": 50, "elapsed": 9,
    "items": [
      {
        "kpiId": "M-30", "name": "クレーム件数(年累計)", "unit": "件",
        "aggType": "累計", "direction": "少ない方が良い",
        "annualTarget": 1, "monthlyTarget": 0,
        "months": [ {"m":1,"value":0}, {"m":2,"value":0}, /* … */ ],
        "current": 1, "progress": 1.333, "judgment": "赤"   // ← 算出値
      }
    ]
  }
}
```

### POST `/api/seisan-kpi/actuals`

```jsonc
// body
{ "period": 50, "kpiId": "M-30", "fiscalMonth": 5, "value": 1 }
// → upsert(実績ID = 50-M30-202512)、AUDIT 記録、判定を再算出して返却
```

---

## 4. パフォーマンス/信頼性の留意点

- **N+1回避**: ダッシュボードは ACTUAL を期一括取得(最大756件)→ メモリ集約。既存知見(売上BI 504対策・期間絞込)を踏襲し、`期` フィルタで取得件数を抑える。
- **キャッシュ**: マスタ・期は変更頻度が低い → menu-permission の部門ツリー同様に Lambda インスタンス内 5分キャッシュを検討。
- **ロック整合**: 確定(ロック)フラグはサーバ側で必ず再検証(クライアント表示のみに依存しない)。
- **監査**: 全 POST/PATCH で AUDIT へ before/after を記録。

---

## ❓要確認(API分)

1. **進捗率/判定の正本値の固定**: Excel 全63指標の `進捗率`・`判定` をテスト期待値として確定してよいか(数式セルの再計算結果を CSV エクスポートして固定)。
2. **総資産回転率の年換算定義**: 「売上高(年換算)」が `累計/経過月×12` か `直近×12` か。Excel 数式の確認が必要(M-02 の算出値 0.858 と整合する定義を採用)。
3. **★対象項目の定義元**: ★達成表の対象4項目を MASTER のフラグで持つか、固定設定表で持つか。
4. **エクスポートのPDF生成方式**: サーバ生成(ヘッドレス)かクライアント生成か。既存PDF実装の流用可否を調査。
5. **効果自動判定の比較基準の既定**: 「基準値(施策開始時)」基準か「前月比」基準か。閾値5%の妥当性。
6. **グループ集計の集計方法**: KPIごとに合算/平均の振り分けを `MASTER.集計タイプ` から自動判定でよいか(率系=平均、累計系=合算)。
7. **Lark部署解決の単位**: KPI/実績の `部署ID`(open_department_id)と部署名の対応付けを移行時にどう確定するか。
