"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { MainLayout } from "@/components/layout";
import {
  FileText,
  Phone,
  Zap,
  ShoppingBag,
  Save,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
} from "lucide-react";

// カテゴリメニュー定義（KPI分析と同じパターン）
type CategoryType = "copy" | "telecom" | "utility" | "supplies";

const CATEGORIES: { id: CategoryType; label: string; icon: React.ReactNode; enabled: boolean }[] = [
  { id: "copy", label: "コピー経費", icon: <FileText className="w-4 h-4" />, enabled: true },
  { id: "telecom", label: "通信費", icon: <Phone className="w-4 h-4" />, enabled: false },
  { id: "utility", label: "光熱費", icon: <Zap className="w-4 h-4" />, enabled: false },
  { id: "supplies", label: "消耗品費", icon: <ShoppingBag className="w-4 h-4" />, enabled: false },
];

// 事業所ごとの印刷種別データ
interface PrintTypeData {
  sheets: number;
  amount: number;
}

// 事業所ごとの行データ
interface OfficeRowData {
  name: string;
  mono: PrintTypeData;
  duo: PrintTypeData;
  color: PrintTypeData;
}

// 金額フォーマット
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// 単価計算（金額 ÷ 枚数、枚数0の場合は0）
function calcUnitPrice(amount: number, sheets: number): number {
  return sheets > 0 ? Math.round((amount / sheets) * 100) / 100 : 0;
}

// 比率計算（種別金額 ÷ 合計金額 × 100）
function calcRatio(amount: number, total: number): number {
  return total > 0 ? Math.round((amount / total) * 1000) / 10 : 0;
}

// 年月のデフォルト値（当月）
function getDefaultYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// year-month文字列 → ミリ秒タイムスタンプ変換
function yearMonthToTimestamp(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).getTime();
}

export default function SoumuExpenseInputPage() {
  const { status } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("copy");
  const [yearMonth, setYearMonth] = useState(getDefaultYearMonth);
  const [offices, setOffices] = useState<string[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [officesError, setOfficesError] = useState<string | null>(null);

  // マトリックスデータ: office名→データ
  const [matrixData, setMatrixData] = useState<Map<string, OfficeRowData>>(new Map());

  // 既存レコードID一覧（削除用）
  const [existingRecordIds, setExistingRecordIds] = useState<string[]>([]);

  // データ読み込み状態
  const [dataLoading, setDataLoading] = useState(false);
  const [isExistingData, setIsExistingData] = useState(false);

  // 保存関連
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // officesが取得済みかどうか
  const officesRef = useRef<string[]>([]);

  // マトリックスを空で初期化
  const initializeEmptyMatrix = useCallback((officeNames: string[]) => {
    const initial = new Map<string, OfficeRowData>();
    for (const name of officeNames) {
      initial.set(name, {
        name,
        mono: { sheets: 0, amount: 0 },
        duo: { sheets: 0, amount: 0 },
        color: { sheets: 0, amount: 0 },
      });
    }
    return initial;
  }, []);

  // 事業所一覧取得
  const fetchOffices = useCallback(async () => {
    setOfficesLoading(true);
    setOfficesError(null);
    try {
      const res = await fetch("/api/master/offices");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "事業所一覧の取得に失敗しました");
      }
      const names: string[] = json.data.map((o: any) => o.name).filter(Boolean);
      setOffices(names);
      officesRef.current = names;
      setMatrixData(initializeEmptyMatrix(names));
    } catch (err) {
      setOfficesError(err instanceof Error ? err.message : "事業所一覧の取得に失敗しました");
    } finally {
      setOfficesLoading(false);
    }
  }, [initializeEmptyMatrix]);

  // 特定月のデータを読み込み → マトリックスに反映
  const loadMonthData = useCallback(async (ym: string) => {
    const currentOffices = officesRef.current;
    if (currentOffices.length === 0) return;

    setDataLoading(true);
    setSaveResult(null);
    setExistingRecordIds([]);
    setIsExistingData(false);

    try {
      const timestamp = yearMonthToTimestamp(ym);
      const res = await fetch(`/api/copy-expense?month=${timestamp}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        // エラーでも空マトリックスで表示
        setMatrixData(initializeEmptyMatrix(currentOffices));
        return;
      }

      const records: Array<{
        record_id: string;
        department: string;
        category: string;
        sheets: number;
        amount: number;
      }> = json.records || [];

      // record_id一覧を保持
      setExistingRecordIds(records.map((r) => r.record_id));

      // マトリックス初期化
      const matrix = initializeEmptyMatrix(currentOffices);

      // 既存データをマトリックスに反映
      for (const rec of records) {
        let row = matrix.get(rec.department);
        if (!row) {
          // マスタにない事業所 → 追加
          row = {
            name: rec.department,
            mono: { sheets: 0, amount: 0 },
            duo: { sheets: 0, amount: 0 },
            color: { sheets: 0, amount: 0 },
          };
          matrix.set(rec.department, row);
          // officesにも追加
          if (!currentOffices.includes(rec.department)) {
            currentOffices.push(rec.department);
          }
        }

        const cat = rec.category;
        if (cat === "モノクロ") {
          row.mono = { sheets: rec.sheets, amount: rec.amount };
        } else if (cat === "2色" || cat === "２色") {
          row.duo = { sheets: rec.sheets, amount: rec.amount };
        } else if (cat === "カラー") {
          row.color = { sheets: rec.sheets, amount: rec.amount };
        }
      }

      setOffices([...currentOffices]);
      officesRef.current = currentOffices;
      setMatrixData(matrix);
      setIsExistingData(records.length > 0);
    } catch {
      setMatrixData(initializeEmptyMatrix(currentOffices));
    } finally {
      setDataLoading(false);
    }
  }, [initializeEmptyMatrix]);

  // 初回: 事業所取得
  useEffect(() => {
    if (status === "authenticated") {
      fetchOffices();
    }
  }, [status, fetchOffices]);

  // 事業所取得完了後 or 年月変更時: データ読み込み
  useEffect(() => {
    if (!officesLoading && officesRef.current.length > 0) {
      loadMonthData(yearMonth);
    }
  }, [yearMonth, officesLoading, loadMonthData]);

  // セル値更新
  const updateCell = useCallback(
    (officeName: string, printType: "mono" | "duo" | "color", field: "sheets" | "amount", value: number) => {
      setMatrixData((prev) => {
        const next = new Map(prev);
        const row = { ...next.get(officeName)! };
        row[printType] = { ...row[printType], [field]: value };
        next.set(officeName, row);
        return next;
      });
      setSaveResult(null);
    },
    []
  );

  // 行合計計算
  const getRowTotal = useCallback((row: OfficeRowData) => {
    const totalAmount = row.mono.amount + row.duo.amount + row.color.amount;
    const totalSheets = row.mono.sheets + row.duo.sheets + row.color.sheets;
    return { totalAmount, totalSheets };
  }, []);

  // 全社合計計算
  const grandTotal = useMemo(() => {
    const total = {
      mono: { sheets: 0, amount: 0 },
      duo: { sheets: 0, amount: 0 },
      color: { sheets: 0, amount: 0 },
      totalAmount: 0,
      totalSheets: 0,
    };
    for (const row of matrixData.values()) {
      total.mono.sheets += row.mono.sheets;
      total.mono.amount += row.mono.amount;
      total.duo.sheets += row.duo.sheets;
      total.duo.amount += row.duo.amount;
      total.color.sheets += row.color.sheets;
      total.color.amount += row.color.amount;
    }
    total.totalAmount = total.mono.amount + total.duo.amount + total.color.amount;
    total.totalSheets = total.mono.sheets + total.duo.sheets + total.color.sheets;
    return total;
  }, [matrixData]);

  // 保存処理（既存データは削除してから新規登録）
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      const timestamp = yearMonthToTimestamp(yearMonth);

      // マトリックスデータをレコード配列に変換
      const records: Array<{
        department: string;
        category: string;
        sheets: number;
        amount: number;
      }> = [];

      for (const row of matrixData.values()) {
        // 枚数 or 金額が入力されているレコードだけ送信
        if (row.mono.sheets > 0 || row.mono.amount > 0) {
          records.push({ department: row.name, category: "モノクロ", sheets: row.mono.sheets, amount: row.mono.amount });
        }
        if (row.duo.sheets > 0 || row.duo.amount > 0) {
          records.push({ department: row.name, category: "2色", sheets: row.duo.sheets, amount: row.duo.amount });
        }
        if (row.color.sheets > 0 || row.color.amount > 0) {
          records.push({ department: row.name, category: "カラー", sheets: row.color.sheets, amount: row.color.amount });
        }
      }

      if (records.length === 0 && existingRecordIds.length === 0) {
        setSaveResult({ type: "warning", message: "入力データがありません" });
        return;
      }

      const res = await fetch("/api/copy-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: timestamp,
          records,
          existingRecordIds, // 削除対象のrecord_id一覧
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error || json.success === false) {
        const debugInfo = json.debug ? `\n[debug] token=${json.debug.tokenLength}文字, table=${json.debug.tableId}` : "";
        const detailInfo = json.results?.[0]?.detail ? `\n[detail] ${JSON.stringify(json.results[0].detail)}` : "";
        setSaveResult({
          type: "error",
          message: (json.error || json.message || "保存に失敗しました") + debugInfo + detailInfo,
        });
        return;
      }

      setSaveResult({
        type: json.errorCount > 0 ? "warning" : "success",
        message: json.message,
      });

      // 保存成功時のみデータを再読み込み
      if (json.successCount > 0) {
        await loadMonthData(yearMonth);
      }
    } catch (err) {
      setSaveResult({
        type: "error",
        message: err instanceof Error ? err.message : "保存に失敗しました",
      });
    } finally {
      setSaving(false);
    }
  }, [yearMonth, matrixData, existingRecordIds, loadMonthData]);

  // 年月ラベル
  const yearMonthLabel = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return `${y}年${m}月`;
  }, [yearMonth]);

  const isLoading = officesLoading || dataLoading;

  return (
    <MainLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>総務部</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-800 font-medium">経費入力</span>
            </div>
            <div className="flex items-center gap-3">
              {/* 年月セレクタ */}
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    setYearMonth(e.target.value);
                    setSaveResult(null);
                  }
                }}
                disabled={saving}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
              />
              {/* 再読み込みボタン */}
              <button
                onClick={() => loadMonthData(yearMonth)}
                disabled={isLoading || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="データ再読み込み"
              >
                {dataLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
              {/* 保存ボタン */}
              <button
                onClick={handleSave}
                disabled={saving || isLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isExistingData ? "上書き保存" : "新規保存"}
              </button>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左カテゴリメニュー */}
          <div className="w-48 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-3 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
              経費カテゴリ
            </h3>
            <nav className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => cat.enabled && setSelectedCategory(cat.id)}
                  disabled={!cat.enabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : cat.enabled
                        ? "text-gray-600 hover:bg-gray-100"
                        : "text-gray-300 cursor-not-allowed"
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  {!cat.enabled && (
                    <span className="ml-auto text-[10px] bg-gray-200 text-gray-400 px-1.5 py-0.5 rounded">
                      準備中
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* 右メインコンテンツ */}
          <div className="flex-1 overflow-auto p-6 bg-gray-50">
            {selectedCategory === "copy" ? (
              <div className="space-y-4">
                {/* タイトル + 状態表示 */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">
                    コピー利用枚数・経費入力 — {yearMonthLabel}
                  </h2>
                  <div className="flex items-center gap-2">
                    {isExistingData && (
                      <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm">
                        <Download className="w-4 h-4" />
                        既存データ読み込み済（{existingRecordIds.length}件）
                      </span>
                    )}
                    {!isExistingData && !isLoading && offices.length > 0 && (
                      <span className="text-sm text-gray-400">新規入力</span>
                    )}
                  </div>
                </div>

                {/* ステータスバー */}
                {saveResult && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                      saveResult.type === "success"
                        ? "bg-green-50 border border-green-200 text-green-700"
                        : saveResult.type === "warning"
                          ? "bg-amber-50 border border-amber-200 text-amber-700"
                          : "bg-red-50 border border-red-200 text-red-700"
                    }`}
                  >
                    {saveResult.type === "success" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {saveResult.message}
                  </div>
                )}

                {/* エラー表示 */}
                {officesError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {officesError}
                  </div>
                )}

                {/* ローディング */}
                {isLoading && (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="ml-3 text-gray-500">
                      {officesLoading ? "事業所一覧を読み込み中..." : "データを読み込み中..."}
                    </span>
                  </div>
                )}

                {/* マトリックステーブル */}
                {!isLoading && offices.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-y-auto max-h-[calc(100vh-160px)]">
                    <table className="w-full text-xs border-collapse table-fixed">
                      {/* 列幅定義: 事業所10% + 種別×3(各枚数7%+単価5%+金額7%+比率4%=23%) + 合計(金額6%+枚数5%=11%) = 100% */}
                      <colgroup>
                        <col style={{ width: "10%" }} />
                        {/* モノクロ */}
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "5%" }} />
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "4%" }} />
                        {/* ２色 */}
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "5%" }} />
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "4%" }} />
                        {/* カラー */}
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "5%" }} />
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "4%" }} />
                        {/* 合計 */}
                        <col style={{ width: "7%" }} />
                        <col style={{ width: "6%" }} />
                      </colgroup>
                      <thead className="sticky top-0 z-20">
                        {/* ヘッダー1行目: 種別グループ */}
                        <tr>
                          <th
                            rowSpan={2}
                            className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 px-2 py-1.5 text-left text-gray-600 font-semibold"
                          >
                            事業所
                          </th>
                          <th colSpan={4} className="border-b border-r border-gray-200 px-1 py-1.5 text-center text-gray-600 font-semibold bg-blue-50">
                            モノクロ
                          </th>
                          <th colSpan={4} className="border-b border-r border-gray-200 px-1 py-1.5 text-center text-gray-600 font-semibold bg-purple-50">
                            ２色
                          </th>
                          <th colSpan={4} className="border-b border-r border-gray-200 px-1 py-1.5 text-center text-gray-600 font-semibold bg-orange-50">
                            カラー
                          </th>
                          <th colSpan={2} className="border-b border-gray-200 px-1 py-1.5 text-center text-gray-600 font-semibold bg-green-50">
                            合計
                          </th>
                        </tr>
                        {/* ヘッダー2行目: 項目名 */}
                        <tr>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-blue-50">枚数</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-blue-50">単価</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-blue-50">金額</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-blue-50">比率</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-purple-50">枚数</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-purple-50">単価</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-purple-50">金額</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-purple-50">比率</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-orange-50">枚数</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-orange-50">単価</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-orange-50">金額</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-orange-50">比率</th>
                          <th className="border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-green-50">金額</th>
                          <th className="border-b border-gray-200 px-1 py-1 text-right text-[10px] text-gray-500 bg-green-50">枚数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offices.map((officeName) => {
                          const row = matrixData.get(officeName);
                          if (!row) return null;
                          const { totalAmount, totalSheets } = getRowTotal(row);
                          return (
                            <OfficeRow
                              key={officeName}
                              row={row}
                              totalAmount={totalAmount}
                              totalSheets={totalSheets}
                              onUpdate={updateCell}
                            />
                          );
                        })}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-20">
                        <tr className="bg-gray-100 font-semibold text-xs">
                          <td className="sticky left-0 z-30 bg-gray-100 border-t-2 border-r border-gray-300 px-2 py-1.5 text-gray-800">
                            全社合計
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800">
                            {formatNumber(grandTotal.mono.sheets)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-600">
                            {calcUnitPrice(grandTotal.mono.amount, grandTotal.mono.sheets).toFixed(2)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800">
                            {formatNumber(grandTotal.mono.amount)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-600">
                            {calcRatio(grandTotal.mono.amount, grandTotal.totalAmount)}%
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800">
                            {formatNumber(grandTotal.duo.sheets)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-600">
                            {calcUnitPrice(grandTotal.duo.amount, grandTotal.duo.sheets).toFixed(2)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800">
                            {formatNumber(grandTotal.duo.amount)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-600">
                            {calcRatio(grandTotal.duo.amount, grandTotal.totalAmount)}%
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800">
                            {formatNumber(grandTotal.color.sheets)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-600">
                            {calcUnitPrice(grandTotal.color.amount, grandTotal.color.sheets).toFixed(2)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800">
                            {formatNumber(grandTotal.color.amount)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-600">
                            {calcRatio(grandTotal.color.amount, grandTotal.totalAmount)}%
                          </td>
                          <td className="bg-gray-100 border-t-2 border-r border-gray-300 px-1 py-1.5 text-right text-gray-800 font-bold">
                            {formatNumber(grandTotal.totalAmount)}
                          </td>
                          <td className="bg-gray-100 border-t-2 border-gray-300 px-1 py-1.5 text-right text-gray-800 font-bold">
                            {formatNumber(grandTotal.totalSheets)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {!isLoading && offices.length === 0 && !officesError && (
                  <div className="text-center py-20 text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>事業所データがありません</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-500 mb-1">準備中</h3>
                  <p className="text-sm text-gray-400">
                    このカテゴリの入力機能は現在準備中です
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// 種別ごとの色テーマ
const PRINT_THEME = {
  mono: { input: "bg-white", border: "border-l-blue-400", calc: "bg-blue-50/60", accent: "text-blue-900" },
  duo: { input: "bg-white", border: "border-l-purple-400", calc: "bg-purple-50/60", accent: "text-purple-900" },
  color: { input: "bg-white", border: "border-l-orange-400", calc: "bg-orange-50/60", accent: "text-orange-900" },
} as const;

// 事業所行コンポーネント
function OfficeRow({
  row,
  totalAmount,
  totalSheets,
  onUpdate,
}: {
  row: OfficeRowData;
  totalAmount: number;
  totalSheets: number;
  onUpdate: (office: string, printType: "mono" | "duo" | "color", field: "sheets" | "amount", value: number) => void;
}) {
  const hasData = totalAmount > 0 || totalSheets > 0;
  return (
    <tr className={hasData ? "bg-white" : "bg-gray-50/50"}>
      <td className={`sticky left-0 z-10 border-b border-r border-gray-200 px-2 py-1 font-medium whitespace-nowrap truncate ${hasData ? "bg-white text-gray-800" : "bg-gray-50/50 text-gray-400"}`}>
        {row.name}
      </td>
      {/* モノクロ */}
      <InputCell value={row.mono.sheets} onChange={(v) => onUpdate(row.name, "mono", "sheets", v)} theme={PRINT_THEME.mono} />
      <CalcCell value={calcUnitPrice(row.mono.amount, row.mono.sheets)} format="decimal" theme={PRINT_THEME.mono} />
      <InputCell value={row.mono.amount} onChange={(v) => onUpdate(row.name, "mono", "amount", v)} theme={PRINT_THEME.mono} />
      <CalcCell value={calcRatio(row.mono.amount, totalAmount)} format="percent" theme={PRINT_THEME.mono} />
      {/* ２色 */}
      <InputCell value={row.duo.sheets} onChange={(v) => onUpdate(row.name, "duo", "sheets", v)} theme={PRINT_THEME.duo} />
      <CalcCell value={calcUnitPrice(row.duo.amount, row.duo.sheets)} format="decimal" theme={PRINT_THEME.duo} />
      <InputCell value={row.duo.amount} onChange={(v) => onUpdate(row.name, "duo", "amount", v)} theme={PRINT_THEME.duo} />
      <CalcCell value={calcRatio(row.duo.amount, totalAmount)} format="percent" theme={PRINT_THEME.duo} />
      {/* カラー */}
      <InputCell value={row.color.sheets} onChange={(v) => onUpdate(row.name, "color", "sheets", v)} theme={PRINT_THEME.color} />
      <CalcCell value={calcUnitPrice(row.color.amount, row.color.sheets)} format="decimal" theme={PRINT_THEME.color} />
      <InputCell value={row.color.amount} onChange={(v) => onUpdate(row.name, "color", "amount", v)} theme={PRINT_THEME.color} />
      <CalcCell value={calcRatio(row.color.amount, totalAmount)} format="percent" theme={PRINT_THEME.color} />
      {/* 合計 */}
      <td className={`border-b border-r border-gray-200 px-1 py-1 text-right font-bold bg-green-50/40 ${totalAmount > 0 ? "text-gray-800" : "text-gray-300"}`}>
        {totalAmount > 0 ? formatNumber(totalAmount) : "-"}
      </td>
      <td className={`border-b border-gray-200 px-1 py-1 text-right font-bold bg-green-50/40 ${totalSheets > 0 ? "text-gray-800" : "text-gray-300"}`}>
        {totalSheets > 0 ? formatNumber(totalSheets) : "-"}
      </td>
    </tr>
  );
}

// 入力セル（編集可能 - 白背景 + 左カラーバー）
function InputCell({
  value,
  onChange,
  theme,
}: {
  value: number;
  onChange: (v: number) => void;
  theme: { input: string; border: string; accent: string };
}) {
  const hasValue = value > 0;
  return (
    <td className={`border-b border-r border-gray-200 p-0 border-l-2 ${theme.border}`}>
      <input
        type="number"
        min={0}
        value={value || ""}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className={`w-full text-right text-xs px-1 py-1 border-0 ${theme.input} focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400 focus:bg-indigo-50 ${hasValue ? `font-semibold ${theme.accent}` : "text-gray-300"}`}
        placeholder="0"
      />
    </td>
  );
}

// 計算セル（読取専用 - 色付き背景 + イタリック）
function CalcCell({
  value,
  format,
  theme,
}: {
  value: number;
  format: "decimal" | "percent";
  theme: { calc: string };
}) {
  const display = format === "percent" ? `${value}%` : value.toFixed(2);
  const hasValue = value > 0;
  return (
    <td className={`border-b border-r border-gray-200 px-1 py-1 text-right text-[10px] italic ${theme.calc} ${hasValue ? "text-gray-600" : "text-gray-300"}`}>
      {hasValue ? display : "-"}
    </td>
  );
}
