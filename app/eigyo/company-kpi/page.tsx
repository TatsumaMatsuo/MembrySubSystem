"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout";
import {
  Target,
  Save,
  RefreshCw,
  Plus,
  Edit2,
  TrendingUp,
  Building2,
  Users,
  Wrench,
  DollarSign,
  PieChart,
  AlertCircle,
  Check,
} from "lucide-react";

// KPIデータの型定義
interface CompanyKPIData {
  recordId?: string;
  period: number;
  // 売上目標
  salesTarget: number;
  monthlySalesTarget: number;
  // 損益計算書ベース
  costOfSales: number;
  costOfSalesRate: number;
  sgaExpenses: number;
  sgaRate: number;
  operatingIncome: number;
  operatingIncomeRate: number;
  // 限界利益ベース
  variableCost: number;
  variableCostRate: number;
  marginalProfit: number;
  marginalProfitRate: number;
  fixedCost: number;
  fixedCostRate: number;
  ordinaryIncome: number;
  ordinaryIncomeRate: number;
  // 製造・外注
  manufacturingCostRate: number;
  executionBudgetRate: number;
  outsourcingRate: number;
  // その他計画
  headcountPlan: number;
  capitalInvestment: number;
  advertisingBudget: number;
  // 備考
  notes: string;
}

// 初期値
const initialData: CompanyKPIData = {
  period: 50,
  salesTarget: 0,
  monthlySalesTarget: 0,
  costOfSales: 0,
  costOfSalesRate: 69,
  sgaExpenses: 0,
  sgaRate: 17,
  operatingIncome: 0,
  operatingIncomeRate: 14,
  variableCost: 0,
  variableCostRate: 56,
  marginalProfit: 0,
  marginalProfitRate: 44,
  fixedCost: 0,
  fixedCostRate: 30,
  ordinaryIncome: 0,
  ordinaryIncomeRate: 14.2,
  manufacturingCostRate: 65,
  executionBudgetRate: 62,
  outsourcingRate: 65,
  headcountPlan: 0,
  capitalInvestment: 0,
  advertisingBudget: 0,
  notes: "",
};

// 金額フォーマット（千円単位）
function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000).toFixed(0)}百万`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}百万`;
  }
  return amount.toLocaleString();
}

// 数値入力フィールドコンポーネント
function NumberInput({
  label,
  value,
  onChange,
  unit = "千円",
  min = 0,
  step = 1,
  readonly = false,
  className = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  step?: number;
  readonly?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm font-medium text-gray-600 w-32 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          step={step}
          readOnly={readonly}
          className={`w-full px-3 py-2 text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            readonly ? "bg-gray-100 text-gray-500" : ""
          }`}
        />
        <span className="text-sm text-gray-500 w-12 shrink-0">{unit}</span>
      </div>
    </div>
  );
}

// セクションヘッダーコンポーネント
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
      <div className="p-2 rounded-lg bg-blue-100 text-blue-600">{icon}</div>
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
    </div>
  );
}

export default function CompanyKPIPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [kpiList, setKpiList] = useState<CompanyKPIData[]>([]);
  const [formData, setFormData] = useState<CompanyKPIData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/company-kpi");
      const data = await response.json();
      if (data.success) {
        setKpiList(data.data || []);
      } else {
        setError(data.error || "データの取得に失敗しました");
      }
    } catch (err) {
      setError("データの取得中にエラーが発生しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 期が選択された時
  useEffect(() => {
    if (selectedPeriod !== null) {
      const selected = kpiList.find((k) => k.period === selectedPeriod);
      if (selected) {
        setFormData(selected);
        setIsEditing(true);
      }
    }
  }, [selectedPeriod, kpiList]);

  // 売上目標が変更された時に自動計算
  useEffect(() => {
    if (formData.salesTarget > 0) {
      const salesTarget = formData.salesTarget;
      setFormData((prev) => ({
        ...prev,
        // 月次売上
        monthlySalesTarget: Math.round(salesTarget / 12),
        // 損益計算書ベース
        costOfSales: Math.round(salesTarget * (prev.costOfSalesRate / 100)),
        sgaExpenses: Math.round(salesTarget * (prev.sgaRate / 100)),
        operatingIncome: Math.round(salesTarget * (prev.operatingIncomeRate / 100)),
        // 限界利益ベース
        variableCost: Math.round(salesTarget * (prev.variableCostRate / 100)),
        marginalProfit: Math.round(salesTarget * (prev.marginalProfitRate / 100)),
        fixedCost: Math.round(salesTarget * (prev.fixedCostRate / 100)),
        ordinaryIncome: Math.round(salesTarget * (prev.ordinaryIncomeRate / 100)),
      }));
    }
  }, [formData.salesTarget, formData.costOfSalesRate, formData.sgaRate, formData.operatingIncomeRate,
      formData.variableCostRate, formData.marginalProfitRate, formData.fixedCostRate, formData.ordinaryIncomeRate]);

  // 新規登録
  const handleNew = () => {
    const maxPeriod = kpiList.length > 0 ? Math.max(...kpiList.map((k) => k.period)) : 49;
    setFormData({ ...initialData, period: maxPeriod + 1 });
    setSelectedPeriod(null);
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  };

  // 保存
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const method = isEditing ? "PUT" : "POST";
      const response = await fetch("/api/company-kpi", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(isEditing ? "KPIを更新しました" : "KPIを登録しました");
        await fetchData();
        if (!isEditing && data.data?.recordId) {
          setFormData((prev) => ({ ...prev, recordId: data.data.recordId }));
          setIsEditing(true);
        }
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch (err) {
      setError("保存中にエラーが発生しました");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // 登録済み期のリスト
  const registeredPeriods = useMemo(() => kpiList.map((k) => k.period), [kpiList]);

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-6 h-6 text-purple-500" />
                全社KPI登録
              </h1>
              <p className="text-sm text-gray-500">KPI &gt; 全社KPI登録</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-bold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                新規登録
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                更新
              </button>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-4">
            {/* 左サイド: 登録済みKPI一覧 */}
            <div className="w-64 shrink-0">
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3">
                  <h3 className="text-sm font-bold text-white">登録済みKPI</h3>
                </div>
                <div className="p-2 max-h-[600px] overflow-y-auto">
                  {kpiList.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      登録されたKPIはありません
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {kpiList.map((kpi) => (
                        <button
                          key={kpi.period}
                          onClick={() => setSelectedPeriod(kpi.period)}
                          className={`w-full px-3 py-2 text-left rounded-lg transition-all ${
                            selectedPeriod === kpi.period
                              ? "bg-purple-100 text-purple-700 font-bold"
                              : "hover:bg-gray-100 text-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm">第{kpi.period}期</span>
                            <span className="text-xs text-gray-500">
                              {formatAmount(kpi.salesTarget)}円
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右サイド: 入力フォーム */}
            <div className="flex-1">
              {/* エラー・成功メッセージ */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  {success}
                </div>
              )}

              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                {/* 期 */}
                <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
                  <label className="text-lg font-bold text-gray-800">対象期:</label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData((prev) => ({ ...prev, period: parseInt(e.target.value) }))}
                    disabled={isEditing}
                    className="px-4 py-2 text-lg font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  >
                    {Array.from({ length: 10 }, (_, i) => 46 + i).map((p) => (
                      <option key={p} value={p} disabled={!isEditing && registeredPeriods.includes(p)}>
                        第{p}期 {registeredPeriods.includes(p) && !isEditing ? "(登録済)" : ""}
                      </option>
                    ))}
                  </select>
                  {isEditing && (
                    <span className="flex items-center gap-1 text-sm text-blue-600">
                      <Edit2 className="w-4 h-4" />
                      編集中
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 売上目標 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<TrendingUp className="w-5 h-5" />} title="売上目標" />
                    <div className="space-y-3">
                      <NumberInput
                        label="売上目標"
                        value={formData.salesTarget}
                        onChange={(v) => setFormData((prev) => ({ ...prev, salesTarget: v }))}
                      />
                      <NumberInput
                        label="月平均"
                        value={formData.monthlySalesTarget}
                        onChange={() => {}}
                        readonly
                      />
                    </div>
                  </div>

                  {/* 損益計算書ベース */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<DollarSign className="w-5 h-5" />} title="損益計算書ベース" />
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <NumberInput
                          label="売上原価"
                          value={formData.costOfSales}
                          onChange={(v) => setFormData((prev) => ({ ...prev, costOfSales: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.costOfSalesRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, costOfSalesRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <NumberInput
                          label="販管費"
                          value={formData.sgaExpenses}
                          onChange={(v) => setFormData((prev) => ({ ...prev, sgaExpenses: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.sgaRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, sgaRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <NumberInput
                          label="営業利益"
                          value={formData.operatingIncome}
                          onChange={(v) => setFormData((prev) => ({ ...prev, operatingIncome: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.operatingIncomeRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, operatingIncomeRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 限界利益ベース */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<PieChart className="w-5 h-5" />} title="限界利益ベース" />
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <NumberInput
                          label="変動費"
                          value={formData.variableCost}
                          onChange={(v) => setFormData((prev) => ({ ...prev, variableCost: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.variableCostRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, variableCostRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <NumberInput
                          label="限界利益"
                          value={formData.marginalProfit}
                          onChange={(v) => setFormData((prev) => ({ ...prev, marginalProfit: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.marginalProfitRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, marginalProfitRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <NumberInput
                          label="固定費"
                          value={formData.fixedCost}
                          onChange={(v) => setFormData((prev) => ({ ...prev, fixedCost: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.fixedCostRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, fixedCostRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                      <div className="flex gap-2">
                        <NumberInput
                          label="経常利益"
                          value={formData.ordinaryIncome}
                          onChange={(v) => setFormData((prev) => ({ ...prev, ordinaryIncome: v }))}
                          className="flex-1"
                        />
                        <NumberInput
                          label=""
                          value={formData.ordinaryIncomeRate}
                          onChange={(v) => setFormData((prev) => ({ ...prev, ordinaryIncomeRate: v }))}
                          unit="%"
                          step={0.1}
                          className="w-32"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 製造・外注目標 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Wrench className="w-5 h-5" />} title="製造・外注目標" />
                    <div className="space-y-3">
                      <NumberInput
                        label="製造原価率"
                        value={formData.manufacturingCostRate}
                        onChange={(v) => setFormData((prev) => ({ ...prev, manufacturingCostRate: v }))}
                        unit="%"
                        step={0.1}
                      />
                      <NumberInput
                        label="実行予算率"
                        value={formData.executionBudgetRate}
                        onChange={(v) => setFormData((prev) => ({ ...prev, executionBudgetRate: v }))}
                        unit="%"
                        step={0.1}
                      />
                      <NumberInput
                        label="外注発注率"
                        value={formData.outsourcingRate}
                        onChange={(v) => setFormData((prev) => ({ ...prev, outsourcingRate: v }))}
                        unit="%"
                        step={0.1}
                      />
                    </div>
                  </div>

                  {/* その他計画 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Building2 className="w-5 h-5" />} title="その他計画" />
                    <div className="space-y-3">
                      <NumberInput
                        label="人員計画"
                        value={formData.headcountPlan}
                        onChange={(v) => setFormData((prev) => ({ ...prev, headcountPlan: v }))}
                        unit="名"
                      />
                      <NumberInput
                        label="設備投資"
                        value={formData.capitalInvestment}
                        onChange={(v) => setFormData((prev) => ({ ...prev, capitalInvestment: v }))}
                      />
                      <NumberInput
                        label="広告販促費"
                        value={formData.advertisingBudget}
                        onChange={(v) => setFormData((prev) => ({ ...prev, advertisingBudget: v }))}
                      />
                    </div>
                  </div>

                  {/* 備考 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Users className="w-5 h-5" />} title="備考" />
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="備考を入力してください..."
                    />
                  </div>
                </div>

                {/* 保存ボタン */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving || formData.salesTarget === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md"
                  >
                    {saving ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {isEditing ? "更新" : "登録"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
