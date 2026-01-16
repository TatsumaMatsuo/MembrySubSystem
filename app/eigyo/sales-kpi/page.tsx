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
  Package,
  Ship,
  Tent,
  Globe,
  Users,
  AlertCircle,
  Check,
  BarChart3,
  ShieldCheck,
} from "lucide-react";

// 営業部KPIデータの型定義
interface SalesKPIData {
  recordId?: string;
  period: number;
  periodStart: string;
  periodEnd: string;
  // 1. 売上目標
  salesTarget: number;
  monthlySalesTarget: number;
  // 2. 粗利目標
  grossProfitTarget: number;
  grossProfitRate: number;
  // 3. テント倉庫(GridHouse含む)売上
  tentWarehouseUnits: number;
  // 4. 膜構造建築物売上
  membraneBuildingSales: number;
  // 5. 畜舎案件売上
  livestockFacilitySales: number;
  // 6. 海洋事業製品売上
  marineSales: number;
  // 7. レンタルテント売上
  rentalTentSales: number;
  // 8. WEB新規問い合わせ
  webInquiriesYearly: number;
  webInquiriesMonthly: number;
  webOrderAmount: number;
  // 9. セールスフォースAランク顧客
  aRankCustomerTarget: number;
  aRankPerSalesRep: number;
  aRankCondition: string;
  // 10. 品質目標
  claimLimitYearly: number;
  // 備考
  notes: string;
}

// 初期値（50期: 令和7年8月1日～令和8年7月31日）
const initialData: SalesKPIData = {
  period: 50,
  periodStart: "2025-08-01",
  periodEnd: "2026-07-31",
  salesTarget: 5500000,
  monthlySalesTarget: 458333,
  grossProfitTarget: 1925000,
  grossProfitRate: 35,
  tentWarehouseUnits: 140,
  membraneBuildingSales: 825000,
  livestockFacilitySales: 280000,
  marineSales: 120000,
  rentalTentSales: 120000,
  webInquiriesYearly: 480,
  webInquiriesMonthly: 40,
  webOrderAmount: 520000,
  aRankCustomerTarget: 30,
  aRankPerSalesRep: 1,
  aRankCondition: "年間受注件数3件以上、年間受注金額2,000万円以上",
  claimLimitYearly: 30,
  notes: "",
};

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
      <label className="text-sm font-medium text-gray-600 w-40 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          step={step}
          readOnly={readonly}
          className={`w-full px-3 py-2 text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            readonly ? "bg-gray-100 text-gray-500" : ""
          }`}
        />
        <span className="text-sm text-gray-500 w-12 shrink-0">{unit}</span>
      </div>
    </div>
  );
}

// セクションヘッダーコンポーネント
function SectionHeader({ icon, title, number }: { icon: React.ReactNode; title: string; number: number }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
      <span className="flex items-center justify-center w-6 h-6 bg-emerald-500 text-white text-xs font-bold rounded-full">
        {number}
      </span>
      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">{icon}</div>
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
    </div>
  );
}

export default function SalesKPIPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [kpiList, setKpiList] = useState<SalesKPIData[]>([]);
  const [formData, setFormData] = useState<SalesKPIData>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // データ取得
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/sales-kpi");
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

  // 売上目標が変更された時に月平均を自動計算
  useEffect(() => {
    if (formData.salesTarget > 0) {
      setFormData((prev) => ({
        ...prev,
        monthlySalesTarget: Math.round(prev.salesTarget / 12),
      }));
    }
  }, [formData.salesTarget]);

  // 粗利率が変更された時に粗利目標を自動計算
  useEffect(() => {
    if (formData.salesTarget > 0 && formData.grossProfitRate > 0) {
      setFormData((prev) => ({
        ...prev,
        grossProfitTarget: Math.round(prev.salesTarget * (prev.grossProfitRate / 100)),
      }));
    }
  }, [formData.salesTarget, formData.grossProfitRate]);

  // WEB問い合わせ年間件数から月間を自動計算
  useEffect(() => {
    if (formData.webInquiriesYearly > 0) {
      setFormData((prev) => ({
        ...prev,
        webInquiriesMonthly: Math.round(prev.webInquiriesYearly / 12),
      }));
    }
  }, [formData.webInquiriesYearly]);

  // 新規登録
  const handleNew = () => {
    const maxPeriod = kpiList.length > 0 ? Math.max(...kpiList.map((k) => k.period)) : 49;
    const newPeriod = maxPeriod + 1;
    const startYear = 2025 + (newPeriod - 50);
    setFormData({
      ...initialData,
      period: newPeriod,
      periodStart: `${startYear}-08-01`,
      periodEnd: `${startYear + 1}-07-31`,
      salesTarget: 0,
      monthlySalesTarget: 0,
      grossProfitTarget: 0,
    });
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
      const response = await fetch("/api/sales-kpi", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(isEditing ? "営業部KPIを更新しました" : "営業部KPIを登録しました");
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

  // 金額フォーマット
  const formatAmount = (amount: number): string => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}百万`;
    }
    return amount.toLocaleString();
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-emerald-50 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-6 h-6 text-emerald-500" />
                営業部KPI登録
              </h1>
              <p className="text-sm text-gray-500">営業部 &gt; 全社KPI &gt; 営業部KPI登録</p>
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
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
                  <h3 className="text-sm font-bold text-white">登録済み営業部KPI</h3>
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
                              ? "bg-emerald-100 text-emerald-700 font-bold"
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
                {/* 期・期間 */}
                <div className="flex items-center gap-6 mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <label className="text-lg font-bold text-gray-800">対象期:</label>
                    <select
                      value={formData.period}
                      onChange={(e) => {
                        const newPeriod = parseInt(e.target.value);
                        const startYear = 2025 + (newPeriod - 50);
                        setFormData((prev) => ({
                          ...prev,
                          period: newPeriod,
                          periodStart: `${startYear}-08-01`,
                          periodEnd: `${startYear + 1}-07-31`,
                        }));
                      }}
                      disabled={isEditing}
                      className="px-4 py-2 text-lg font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                    >
                      {Array.from({ length: 10 }, (_, i) => 46 + i).map((p) => (
                        <option key={p} value={p} disabled={!isEditing && registeredPeriods.includes(p)}>
                          第{p}期 {registeredPeriods.includes(p) && !isEditing ? "(登録済)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">
                    期間: {formData.periodStart} ～ {formData.periodEnd}
                  </div>
                  {isEditing && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600">
                      <Edit2 className="w-4 h-4" />
                      編集中
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 1. 売上目標 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<TrendingUp className="w-5 h-5" />} title="売上目標" number={1} />
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

                  {/* 2. 粗利目標 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<BarChart3 className="w-5 h-5" />} title="粗利目標" number={2} />
                    <div className="space-y-3">
                      <NumberInput
                        label="粗利目標"
                        value={formData.grossProfitTarget}
                        onChange={(v) => setFormData((prev) => ({ ...prev, grossProfitTarget: v }))}
                      />
                      <NumberInput
                        label="粗利率"
                        value={formData.grossProfitRate}
                        onChange={(v) => setFormData((prev) => ({ ...prev, grossProfitRate: v }))}
                        unit="%"
                        step={0.1}
                      />
                    </div>
                  </div>

                  {/* 3. テント倉庫売上 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Tent className="w-5 h-5" />} title="テント倉庫(GridHouse含む)売上" number={3} />
                    <div className="space-y-3">
                      <NumberInput
                        label="販売棟数"
                        value={formData.tentWarehouseUnits}
                        onChange={(v) => setFormData((prev) => ({ ...prev, tentWarehouseUnits: v }))}
                        unit="棟"
                      />
                    </div>
                  </div>

                  {/* 4. 膜構造建築物売上 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Building2 className="w-5 h-5" />} title="膜構造建築物売上" number={4} />
                    <div className="space-y-3">
                      <NumberInput
                        label="売上目標"
                        value={formData.membraneBuildingSales}
                        onChange={(v) => setFormData((prev) => ({ ...prev, membraneBuildingSales: v }))}
                      />
                    </div>
                  </div>

                  {/* 5. 畜舎案件売上 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Package className="w-5 h-5" />} title="畜舎案件売上" number={5} />
                    <div className="space-y-3">
                      <NumberInput
                        label="売上目標"
                        value={formData.livestockFacilitySales}
                        onChange={(v) => setFormData((prev) => ({ ...prev, livestockFacilitySales: v }))}
                      />
                    </div>
                  </div>

                  {/* 6. 海洋事業製品売上 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Ship className="w-5 h-5" />} title="海洋事業製品売上" number={6} />
                    <div className="space-y-3">
                      <NumberInput
                        label="売上目標"
                        value={formData.marineSales}
                        onChange={(v) => setFormData((prev) => ({ ...prev, marineSales: v }))}
                      />
                    </div>
                  </div>

                  {/* 7. レンタルテント売上 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Tent className="w-5 h-5" />} title="レンタルテント売上" number={7} />
                    <div className="space-y-3">
                      <NumberInput
                        label="売上目標"
                        value={formData.rentalTentSales}
                        onChange={(v) => setFormData((prev) => ({ ...prev, rentalTentSales: v }))}
                      />
                    </div>
                  </div>

                  {/* 8. WEB新規問い合わせ */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Globe className="w-5 h-5" />} title="WEB新規問い合わせ件数・受注" number={8} />
                    <div className="space-y-3">
                      <NumberInput
                        label="年間件数"
                        value={formData.webInquiriesYearly}
                        onChange={(v) => setFormData((prev) => ({ ...prev, webInquiriesYearly: v }))}
                        unit="件"
                      />
                      <NumberInput
                        label="月間件数"
                        value={formData.webInquiriesMonthly}
                        onChange={() => {}}
                        unit="件"
                        readonly
                      />
                      <NumberInput
                        label="受注金額"
                        value={formData.webOrderAmount}
                        onChange={(v) => setFormData((prev) => ({ ...prev, webOrderAmount: v }))}
                      />
                    </div>
                  </div>

                  {/* 9. セールスフォースAランク顧客 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<Users className="w-5 h-5" />} title="セールスフォースAランク顧客" number={9} />
                    <div className="space-y-3">
                      <NumberInput
                        label="目標件数"
                        value={formData.aRankCustomerTarget}
                        onChange={(v) => setFormData((prev) => ({ ...prev, aRankCustomerTarget: v }))}
                        unit="件"
                      />
                      <NumberInput
                        label="営業1人あたり"
                        value={formData.aRankPerSalesRep}
                        onChange={(v) => setFormData((prev) => ({ ...prev, aRankPerSalesRep: v }))}
                        unit="件"
                      />
                      <div className="flex items-start gap-2">
                        <label className="text-sm font-medium text-gray-600 w-40 shrink-0 pt-2">条件</label>
                        <input
                          type="text"
                          value={formData.aRankCondition}
                          onChange={(e) => setFormData((prev) => ({ ...prev, aRankCondition: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="例: 年間受注件数3件以上、年間受注金額2,000万円以上"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 10. 品質目標 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <SectionHeader icon={<ShieldCheck className="w-5 h-5" />} title="品質目標" number={10} />
                    <div className="space-y-3">
                      <NumberInput
                        label="クレーム上限"
                        value={formData.claimLimitYearly}
                        onChange={(v) => setFormData((prev) => ({ ...prev, claimLimitYearly: v }))}
                        unit="件/年"
                      />
                      <p className="text-xs text-gray-500 ml-40">※営業部起因によるもの</p>
                    </div>
                  </div>

                  {/* 備考 */}
                  <div className="bg-gray-50 rounded-lg p-4 lg:col-span-2">
                    <SectionHeader icon={<Edit2 className="w-5 h-5" />} title="備考" number={11} />
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full h-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                      placeholder="備考を入力してください..."
                    />
                  </div>
                </div>

                {/* 保存ボタン */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving || formData.salesTarget === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all shadow-md"
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
