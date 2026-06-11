# 生産本部 KPIマネジメントシステム 設計ドキュメント

> 月次レビューと現場PDCAを一気通貫で支える仕組みを、現行 MembrySubSystem(Next.js + Lark Base)へ組み込むための設計一式。

## 📌 本ドキュメントの位置づけ

- **入力資料**
  - `KPIシステム要件定義書.docx`(生産本部 本部長 山口信之 発行 / 2026年6月 / v1.0)
  - `50期生産本部KPIマスタ(0526最終).xlsx`(**仕様の正本**=計算式・判定ルールの最終根拠)
- **本フェーズの成果物**: 設計ドキュメントのみ(**コーディングは未着手**)
- **対象期**: 50期(令和7年8月1日 〜 令和8年7月31日)

## 📂 ドキュメント構成

| No. | ファイル | 内容 |
|-----|---------|------|
| 01 | [`01_requirements-analysis.md`](./01_requirements-analysis.md) | 要件分析サマリー(Why/What/Who/When/How) |
| 02 | [`02_data-model.md`](./02_data-model.md) | データモデル設計(Lark Base テーブル定義) |
| 03 | [`03_screens-and-features.md`](./03_screens-and-features.md) | 画面・機能設計(生産本部8機能 + 経営4機能) |
| 04 | [`04_api-design.md`](./04_api-design.md) | API設計・判定/★/効果/グループ集計/中計補間ロジック |
| 05 | [`05_integration-and-permissions.md`](./05_integration-and-permissions.md) | 既存システム統合・6ロール権限設計 |
| 06 | [`06_implementation-plan.md`](./06_implementation-plan.md) | 段階的実装計画・データ移行・並行運用 |
| 07 | [`07_kpi-layering.md`](./07_kpi-layering.md) | KPI階層整理(中期経営計画/全社KPI/部署別KPI・会計データ入力) |
| 08 | [`08_lark-base-setup.md`](./08_lark-base-setup.md) | Lark Base 構築仕様(13テーブルのフィールド定義・選択肢・env登録)#56 |
| 🖼 | [`mockups/`](./mockups/) | 画面モックアップ8枚(すり合わせ用)。経営DB/現場DB/実績入力/施策PDCA/★達成/マスタ/過去実績/ヘルプ |

### 機能一覧(画面=機能単位)

| 系統 | 機能 | ルート |
|------|------|--------|
| 経営 | 中期経営計画ダッシュボード | `/keiei/dashboard` |
| 経営 | 全社KPI(年度計画 vs 実績) | `/keiei/company-kpi` |
| 経営 | 会計データ入力(月/四半期/半期) | `/keiei/kaikei-input` |
| 経営 | 中計マスタ管理 | `/keiei/midterm` |
| 生産本部 | ① ダッシュボード | `/seisan-kpi/dashboard` |
| 生産本部 | ② KPI実績入力 | `/seisan-kpi/input` |
| 生産本部 | ③ 施策管理(PDCA) | `/seisan-kpi/measures` |
| 生産本部 | ④ ★達成評価(部署ごと) | `/seisan-kpi/stars` |
| 生産本部 | ⑤ マスタ管理(KPI/グループ) | `/seisan-kpi/master` |
| 生産本部 | ⑥ 過去実績参照(全社/部署/グループ) | `/seisan-kpi/history` |
| 生産本部 | ⑦ データエクスポート | `/seisan-kpi/export` |
| 共通 | ⑧ ヘルプ(運用ガイド) | `/seisan-kpi/help` |

> 抽出済みの原本テキストは `.claude/_kpi_req.txt`(要件定義書)、`.claude/_kpi_master.txt`(Excel 全シート)に保存済み。実装時の一次参照に使用する。

## 🎯 ひとことで言うと

現状 Excel で運用している「63指標 × 4階層 × 月次」のKPI管理を、

1. **同じ最新値を全員が見る**(Lark Base に集約・履歴管理)
2. **1画面で経営状況が分かる**(会議投影用ダッシュボード)
3. **入力即判定**(緑/黄/赤の信号表示)
4. **現場PDCAと★評価**(施策の計画→実施→効果、月間達成で★)

を満たす Web アプリとして MembrySubSystem に統合する。

## 🧱 設計の基本方針(サマリー)

- **既存パターン踏襲**: `app/eigyo/{company-kpi,sales-kpi,sales-bi}` の「page.tsx(use client + force-dynamic)+ `api/.../route.ts`(parseRecord)+ Lark Base」構成をそのまま流用。
- **2系統メニュー**: `経営`(中計・全社KPI・会計入力)と `生産本部KPI` を `MENU_GROUPS` / メニュー表示マスタ・機能配置マスタに追加し、既存の3階層メニュー権限システムに乗せる。
- **データは Lark Base(project base)に新規テーブル ≒14本**(経営3 + 既存`COMPANY_KPI`流用 + 生産本部9: マスタ/期/**グループ/グループ所属(M:N)**/実績/施策/PDCA/★調整/過去/監査)。`lib/lark-tables.ts` を拡張。
- **部署マスタ = Lark Contact 部門**: 独自マスタを作らず Lark部署を正とする(既存 `lib/menu-permission.ts` の部門ツリー流用。改称・組織変更に追従)。
- **会計データは1本化**(`KAIKEI_ACTUAL`・本部長一括入力)。生産本部Lv2(粗利率等)も同じ会計データを参照(二重入力なし)。
- **判定・★・効果・グループ集計・中計補間は「保存値 + 読込時算出」**。Excel の計算式を `lib/kpi/` の純関数に移植し、正本との一致を回帰テスト+並行運用で検証。
- **中計は拡張可能**: ヘッダ+明細で複数中計を並存(50→52期に続けて53→55期…をマスタ追加で延伸)。
- **Excel が正本**: 数値・判定が現行と一致することを 1〜2ヶ月の並行運用で確認してから切替。

## ⚠️ 設計上の要確認事項(オープン項目)

各ドキュメント末尾に `❓要確認` として列挙。主なもの:

1. KPI実績の保持形式(縦持ち=月×KPIの1レコード を推奨。Excel は横持ち)
2. Lv2/Lv3 実績の扱い(下位合算の自動ロールアップ or 手入力)— Excel は手入力/数式
3. 6ロールと既存「部署ベース権限」のマッピング詳細
4. 課長ロールの実装可否(要件定義 §3「今のExcelにはないが実装できれば」)
5. 月次確定データのロック単位・解除フロー
