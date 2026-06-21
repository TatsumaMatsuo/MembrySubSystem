"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { useIsMobile } from "@/lib/use-is-mobile";
import { JUDGE_GREEN, JUDGE_AMBER } from "@/lib/kpi";

/**
 * ⑧ ヘルプ(運用ガイド) — Excel 00_運用ガイド のアプリ内版。
 * 各画面の「?ヘルプ」から該当セクション(#anchor)へ遷移する文脈ヘルプに対応。
 * 判定基準・★ルールは lib/kpi の実装(JUDGE_GREEN/JUDGE_AMBER)と整合(単一の正)。
 */
const TOC = [
  ["overview", "このシステムについて"],
  ["flow", "月次運用フロー"],
  ["timing", "入力タイミング"],
  ["judge", "判定基準(緑/黄/赤)"],
  ["star", "★達成のルール"],
  ["features", "機能の使い方"],
  ["map", "旧Excel → 新機能 対応"],
  ["terms", "用語集"],
] as const;

const FLOW = [
  ["1", "前月実績を入力", "毎月初・前月実績は当月10日前後確定", "担当(生産管理課)が「KPI実績入力」で通常KPI(品質・納期・生産性・安全)を入力。入力すると判定(緑黄赤)が即時表示。"],
  ["2", "施策の計画・実施・効果を記入", "月次", "各部責任者が「施策管理」で重点施策のPlan/Do/Check(効果)を記入。効果は対象KPI実績から自動判定→確定。"],
  ["3", "ダッシュボード確認・本部長コメント", "月次会議前", "本部長が「ダッシュボード」で全KPIをレビューし、施策に本部長コメントを記入。"],
  ["4", "会議で翌月アクション決定・記録", "月次レビュー会議", "本部長+各責任者が会議で翌月アクション(継続/強化/見直し/完了)を決定し記録。画面を投影して使用。"],
  ["5", "経営KPIの確定値を入力", "翌々月・経理確定後", "本部長が「経営」エリアで会計データ(売上高・製造原価・総資産・材料金額 等)を入力→粗利率・総資産回転率・材料金額比率を自動算出。"],
];

export default function SeisanKpiHelpPage() {
  const isMobile = useIsMobile();
  // ?section= またはハッシュで該当セクションへスクロール
  useEffect(() => {
    const hash = window.location.hash?.replace("#", "");
    const sp = new URLSearchParams(window.location.search);
    const target = sp.get("section") || hash;
    if (target) {
      const el = document.getElementById(target);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }, []);

  const greenPct = Math.round(JUDGE_GREEN * 100);
  const amberPct = Math.round(JUDGE_AMBER * 100);

  return (
    <MainLayout>
      <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1f3864", color: "#fff", borderRadius: 14, padding: isMobile ? "12px 16px" : "16px 24px", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: isMobile ? 16 : 19, margin: 0, fontWeight: 700 }}>📖 ヘルプ ― 運用ガイド</h1>
          <div style={{ fontSize: 12, opacity: 0.85 }}>山口産業株式会社 生産本部 / 50期(令和7年8月1日〜令和8年7月31日)</div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "210px 1fr", gap: isMobile ? 12 : 18, alignItems: "start" }}>
          {/* 目次（モバイルは横並び・非スティッキー） */}
          <nav style={{ position: isMobile ? "static" : "sticky", top: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: isMobile ? 10 : 14, fontSize: 13, display: isMobile ? "flex" : "block", flexWrap: "wrap", gap: isMobile ? 4 : 0 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: isMobile ? 0 : "0 4px 6px", width: isMobile ? "100%" : undefined }}>目次</div>
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} style={{ display: "block", color: "#475569", textDecoration: "none", padding: "6px 8px", borderRadius: 7, ...(isMobile ? { background: "#f1f5f9", fontSize: 12 } : {}) }}>{label}</a>
            ))}
          </nav>

          <main style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* 概要 */}
            <Card id="overview" title="このシステムについて">
              <p style={p}>生産本部のKPIを「経営目標〜現場」まで4階層(経営/Lv2生産本部/Lv3製造部・生産管理部/Lv4各課)で管理し、月次レビューと現場PDCAを一気通貫で支える仕組みです。Excel運用を1システムに集約し、全員が同じ最新値を見られます。</p>
              <p style={{ ...p, marginBottom: 0 }}>メニューは <Pill>経営</Pill>(中期経営計画・全社KPI・会計データ入力)と <Pill>生産本部KPI</Pill>(ダッシュボード・実績入力・施策・★達成 等)の2系統です。</p>
            </Card>

            {/* フロー */}
            <Card id="flow" title="月次運用フロー">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {FLOW.map(([no, ttl, when, desc], i) => (
                  <div key={no} style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: "0 0 30px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: "#1f3864", color: "#fff", fontWeight: 800, fontSize: 13 }}>{no}</span>
                      {i < FLOW.length - 1 && <span style={{ width: 2, background: "#e2e8f0", flex: 1, margin: "2px 0" }} />}
                    </div>
                    <div style={{ paddingBottom: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{ttl} <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>{when}</span></div>
                      <div style={{ fontSize: 12.5, color: "#475569" }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 入力タイミング */}
            <Card id="timing" title="入力タイミングの考え方">
              <Table head={["区分", "タイミング", "理由"]} rows={[
                ["通常KPI(品質・納期・生産性・安全)", "翌月", "前月実績が翌月10日前後に確定するため"],
                ["経営KPI(粗利率・総資産回転率・材料金額比率)", "翌々月", "経理確定を待つため。率は直接入力せず会計データから累計ベースで自動算出"],
                ["在庫(在庫+仕掛)金額", "翌々月", "累計や平均ではなく「直近月の数値」が最新値"],
                ["会計データ(粒度可変)", "月/四半期/半期", "科目ごとに出るタイミングで入力(総資産=半期 等)。年度累計に正規化"],
              ]} />
            </Card>

            {/* 判定基準 */}
            <Card id="judge" title="判定基準(緑/黄/赤)">
              <p style={{ ...p, marginBottom: 6 }}>全型の達成率を「高いほど良い」に正規化した3段階。<b>正本は現行Excel</b>に準拠し、システムの判定ロジック(<code>lib/kpi</code>)と一致しています。</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0" }}>
                <JudgeChip color="#16a34a" label="緑" rule={`達成率 ${greenPct}% 以上`} />
                <JudgeChip color="#d97706" label="黄" rule={`達成率 ${amberPct}% 〜 ${greenPct}%`} />
                <JudgeChip color="#dc2626" label="赤" rule={`達成率 ${amberPct}% 未満`} />
              </div>
              <Table head={["型", "緑", "黄", "赤"]} rows={[
                ["少ない方が良い(累計・件数系)", "月次目標以下", "月次目標の100〜150%", "150%超"],
                ["直近月値(在庫+仕掛)", `達成率${greenPct}%以上`, `${amberPct}〜${greenPct}%`, `${amberPct}%未満`],
                ["外注金額(累計 vs 月割合算)", "目標達成", "目標の100〜110%", "110%超"],
                ["高い方が良い・平均型(粗利率等)", "目標達成", `目標の${greenPct}〜100%`, `${greenPct}%未満`],
              ]} />
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>※ 原則: 緑=達成率{greenPct}%以上 or 年間ペース内 / 黄={amberPct}〜{greenPct}% / 赤={amberPct}%未満。型ごとの達成率定義で正規化。</div>
            </Card>

            {/* ★ルール */}
            <Card id="star" title="★達成のルール">
              <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li><b>月間目標達成で★1個</b>(部署ごと・項目ごと)。</li>
                <li><b>年間目標を期末累計で達成すると★+3</b>(期末のみ)。</li>
                <li><b>5S大賞・労災は手入力</b>で★を増減(例: 5S大賞 +1〜+3 / 労災 −2〜−5)。</li>
                <li><b>自動で付いた★はクリックで手動削除できる</b>(誤判定や対象外の月を除外)。削除した★は再クリックで復元。削除分は合計★から除かれる。</li>
                <li>「総合計★数」= 自動★ + 期末ボーナス + 手入力調整。製造部6課でランキング表示。</li>
                <li>間接部門は「経過月内の空欄も達成扱い」の特例あり。</li>
              </ul>
            </Card>

            {/* 機能の使い方 */}
            <Card id="features" title="機能の使い方(クイックガイド)">
              <Table head={["機能", "使い方"]} rows={[
                ["① ダッシュボード", "①信号盤で全体把握→②赤・黄の件数確認→③該当KPI特定→④原因分析・施策決定→⑤★達成確認。会議で投影。"],
                ["② KPI実績入力", "部署・対象月を選び黄色セルに実績入力。判定が即時表示。確定済み月はロック。"],
                ["③ 施策管理(PDCA)", "グループを選び、左の施策一覧から選択→右にPDCA履歴。対象KPIを選ぶと実績/目標/判定が自動表示。施策は無制限に追加可。"],
                ["④ ★達成評価", "部署ごとの★を確認。5S大賞・労災は手入力。製造部6課でランキング。"],
                ["⑤ マスタ管理", "管理者がKPI定義・目標値・グループ構成を編集。期切替は新期作成(前期複製)。"],
                ["⑥ 過去実績参照", "全社/部署別/グループ別で過去推移と50期目標を照会。目標妥当性を検証。"],
                ["⑦ エクスポート", "KPI実績・施策ログ・★達成表を CSV/PDF 出力(会議資料・他システム連携用)。"],
              ]} />
            </Card>

            {/* 対応表 */}
            <Card id="map" title="旧Excel → 新機能 対応">
              <Table head={["旧シート", "新機能"]} rows={[
                ["01_ダッシュボード", "生産本部KPI ＞ ダッシュボード"],
                ["02_KPI実績入力", "生産本部KPI ＞ KPI実績入力 ／ 経営 ＞ 会計データ入力(基礎データ)"],
                ["03_施策管理", "生産本部KPI ＞ 施策管理(PDCA)"],
                ["04・05_★達成表", "生産本部KPI ＞ ★達成評価"],
                ["06_過去実績", "生産本部KPI ＞ 過去実績参照"],
                ["07_KPIマスタ", "生産本部KPI ＞ マスタ管理"],
                ["00_運用ガイド", "本ヘルプ(運用ガイド)"],
              ]} />
            </Card>

            {/* 用語集 */}
            <Card id="terms" title="用語集">
              <Table rows={[
                ["KPI_ID", "各指標の業務キー(例: M-30)。マスタ・実績・施策を連結する。"],
                ["集計タイプ", "累計(積み上げ)/平均(経過月平均)/直近月値(最新月)/基礎データ算出(会計から算出)。"],
                ["基礎データ算出KPI", "粗利率・総資産回転率・材料金額比率。率を直接入力せず会計データから算出。"],
                ["経過月数", "実績が確定している月数。進捗率・★・月割合算の基準。"],
                ["グループ", "部署を束ねる集約レンズ(例: 鉄工課グループ)。1部署が複数グループに重複所属可。"],
                ["中期経営計画(中計)", "複数年(50→52期)のKGI(売上67億・ROA13%・労働生産性10百万円/人)。線形補間で年度目標を生成。"],
                ["部署", "Lark Contactの部門を使用(改称・組織変更に自動追従)。"],
              ]} termCol />
            </Card>
          </main>
        </div>
      </div>
      </div>
    </MainLayout>
  );
}

/* ===== building blocks ===== */
function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(15,23,42,.05)", scrollMarginTop: 16 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 12px", color: "#1f3864", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 5, height: 17, background: "#1f3864", borderRadius: 3, display: "inline-block" }} />{title}
      </h2>
      {children}
    </div>
  );
}
function Table({ head, rows, termCol }: { head?: string[]; rows: string[][]; termCol?: boolean }) {
  return (
    <div style={{ overflowX: "auto" }}>
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, marginTop: 6 }}>
      {head && <thead><tr>{head.map((h) => <th key={h} style={thtd(true)}>{h}</th>)}</tr></thead>}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => (
            <td key={j} style={{ ...thtd(false), ...(termCol && j === 0 ? { fontWeight: 700, color: "#1f3864", whiteSpace: "nowrap" as const } : {}) }}>{c}</td>
          ))}</tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#e0e7ff", color: "#3730a3" }}>{children}</span>;
}
function JudgeChip({ color, label, rule }: { color: string; label: string; rule: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 9, padding: "6px 12px", fontSize: 12 }}>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#fff", background: color }}>{label}</span>
      <span style={{ color: "#475569" }}>{rule}</span>
    </div>
  );
}
const p: React.CSSProperties = { fontSize: 13, margin: "0 0 8px" };
function thtd(isHead: boolean): React.CSSProperties {
  return { padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left", verticalAlign: "top", fontSize: isHead ? 11.5 : 12.5, fontWeight: isHead ? 600 : 400, background: isHead ? "#f1f5f9" : undefined, color: isHead ? "#64748b" : "#1e293b" };
}
