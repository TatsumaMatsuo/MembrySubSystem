"use client";

import { useState } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Calendar, Loader2 } from "lucide-react";
import { useToast, ToastContainer } from "@/components/features/syaryo/ui/toast";

type ExportType = "licenses" | "vehicles" | "insurance" | "history" | "all";
type ExportFormat = "csv" | "xlsx";

export default function ExportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [exportType, setExportType] = useState<ExportType>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  // 未認証の場合はログインページにリダイレクト
  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: exportType,
        format: exportFormat,
      });

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/syaryo/export?${params.toString()}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "エクスポートに失敗しました");
      }

      // ファイルをダウンロード
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `export.${exportFormat}`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("エクスポートが完了しました");
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error instanceof Error ? error.message : "エクスポートに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const exportTypes: { value: ExportType; label: string; description: string }[] = [
    { value: "all", label: "全データ", description: "免許証・車検証・保険証・承認履歴の全て" },
    { value: "licenses", label: "免許証", description: "運転免許証の登録データ" },
    { value: "vehicles", label: "車検証", description: "車検証の登録データ" },
    { value: "insurance", label: "保険証", description: "任意保険の登録データ" },
    { value: "history", label: "承認履歴", description: "承認・却下の履歴データ" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* ページヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="h-7 w-7" />
          データエクスポート
        </h1>
        <p className="mt-2 text-gray-600">
          申請データや承認履歴をCSV/Excel形式でダウンロードできます
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* エクスポート対象 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            エクスポート対象
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exportTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setExportType(type.value)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  exportType === type.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">{type.label}</div>
                <div className="text-xs text-gray-500 mt-1">{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ファイル形式 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            ファイル形式
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setExportFormat("xlsx")}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                exportFormat === "xlsx"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium">Excel (.xlsx)</div>
                <div className="text-xs text-gray-500">複数シート対応</div>
              </div>
            </button>
            <button
              onClick={() => setExportFormat("csv")}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                exportFormat === "csv"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">CSV (.csv)</div>
                <div className="text-xs text-gray-500">単一シート</div>
              </div>
            </button>
          </div>
        </div>

        {/* 日付フィルター（履歴のみ） */}
        {(exportType === "history" || exportType === "all") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <Calendar className="h-4 w-4 inline mr-1" />
              日付範囲（承認履歴のフィルター）
            </label>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="self-end px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  クリア
                </button>
              )}
            </div>
          </div>
        )}

        {/* エクスポートボタン */}
        <div className="pt-4 border-t">
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                エクスポート中...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                エクスポート実行
              </>
            )}
          </button>
        </div>
      </div>

      {/* 注意事項 */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-800 mb-2">注意事項</h3>
        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
          <li>エクスポートされたデータには個人情報が含まれます。取り扱いにご注意ください。</li>
          <li>CSV形式はUTF-8（BOM付き）で出力されます。Excelで開く場合は文字化けしません。</li>
          <li>Excel形式では、データ種別ごとに別シートで出力されます。</li>
        </ul>
      </div>

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
