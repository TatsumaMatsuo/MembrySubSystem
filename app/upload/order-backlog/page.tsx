"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Settings,
  ChevronDown,
  StopCircle,
} from "lucide-react";
import { DataMappingConfig } from "@/types/data-mapping";

interface UploadResult {
  success: boolean;
  configName: string;
  totalRows: number;
  inserted: number;
  updated: number;
  errors: string[];
}

interface ProgressState {
  current: number;
  total: number;
  inserted: number;
  updated: number;
  percentage: number;
}

export default function OrderBacklogUploadPage() {
  // マッピング設定
  const [configs, setConfigs] = useState<DataMappingConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<DataMappingConfig | null>(null);
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // アップロード状態
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // マッピング設定を読み込み
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch("/api/settings/data-mapping");
      const data = await response.json();
      if (response.ok) {
        setConfigs(data.configs || []);
        // 最初の設定をデフォルトで選択
        if (data.configs.length > 0) {
          setSelectedConfig(data.configs[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load configs:", err);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Excelファイルのみ許可
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (
        !validTypes.includes(selectedFile.type) &&
        !selectedFile.name.endsWith(".xlsx") &&
        !selectedFile.name.endsWith(".xls")
      ) {
        setError("Excelファイル（.xlsx, .xls）を選択してください");
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setProgress(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("ファイルを選択してください");
      return;
    }

    if (!selectedConfig) {
      setError("マッピング設定を選択してください");
      return;
    }

    // AbortControllerを作成
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);
    setCancelled(false);
    setProgress({ current: 0, total: 0, inserted: 0, updated: 0, percentage: 0 });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("configId", selectedConfig.id);
      formData.append("stream", "true");

      const response = await fetch("/api/upload/generic", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMsg = `アップロードに失敗しました (HTTP ${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch {
          // JSONパースに失敗した場合（HTMLリダイレクト等）
          errorMsg = `アップロードに失敗しました (HTTP ${response.status}: ${response.statusText})`;
        }
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // SSEストリームを処理
      const reader = response.body?.getReader();
      if (!reader) {
        setError("ストリームの読み取りに失敗しました");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                setProgress({
                  current: data.current,
                  total: data.total,
                  inserted: data.inserted,
                  updated: data.updated,
                  percentage: data.total > 0 ? Math.round((data.current / data.total) * 100) : 0,
                });
              } else if (data.type === "complete") {
                setResult({
                  success: true,
                  configName: data.configName || selectedConfig.name,
                  totalRows: data.total,
                  inserted: data.inserted,
                  updated: data.updated,
                  errors: data.errors || [],
                });
                setProgress(null);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (err: any) {
      if (err instanceof Error && err.name === "AbortError") {
        setCancelled(true);
        // キャンセル時は現在の進捗を保持
      } else {
        console.error("Upload error:", err);
        const detail = err?.message || String(err);
        setError(`アップロード中にエラーが発生しました: ${detail}`);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (
        droppedFile.name.endsWith(".xlsx") ||
        droppedFile.name.endsWith(".xls")
      ) {
        setFile(droppedFile);
        setError(null);
        setResult(null);
        setProgress(null);
      } else {
        setError("Excelファイル（.xlsx, .xls）を選択してください");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
    setCancelled(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-hidden">
        {/* ページタイトル */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-500" />
            データアップロード
          </h1>
          <p className="text-sm text-gray-500">
            I/F &gt; データアップロード
          </p>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* マッピング設定選択 */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-base font-bold mb-4 text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                マッピング設定
              </h2>

              {loadingConfigs ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  設定を読み込み中...
                </div>
              ) : configs.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    マッピング設定がありません。
                    <a
                      href="/settings/data-mapping"
                      className="underline font-medium hover:text-yellow-800"
                    >
                      システム設定 &gt; データマッピング
                    </a>
                    から設定を作成してください。
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedConfig?.id || ""}
                    onChange={(e) => {
                      const config = configs.find((c) => c.id === e.target.value);
                      setSelectedConfig(config || null);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  >
                    {configs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name}
                        {config.description ? ` - ${config.description}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              )}

              {selectedConfig && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">テーブルID:</span>
                      <span className="ml-2 text-gray-800 font-mono text-xs">
                        {selectedConfig.tableId}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">キー項目:</span>
                      <span className="ml-2 text-gray-800">
                        {selectedConfig.keyField}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">マッピング項目:</span>
                      <span className="ml-2 text-gray-800">
                        {selectedConfig.mappings.length}件
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* アップロードエリア */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-base font-bold mb-4 text-gray-800">
                Excelファイルをアップロード
              </h2>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  loading
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                    : file
                    ? "border-indigo-400 bg-indigo-50 cursor-pointer"
                    : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet className="w-12 h-12 text-indigo-500" />
                    <p className="text-lg font-medium text-gray-800">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-12 h-12 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600">
                      ファイルをドラッグ＆ドロップ
                    </p>
                    <p className="text-sm text-gray-500">
                      またはクリックして選択（.xlsx, .xls）
                    </p>
                  </div>
                )}
              </div>

              {/* プログレスバー */}
              {progress && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{cancelled ? "中断しました" : "処理中..."}</span>
                    <span>{progress.current} / {progress.total} 件 ({progress.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ease-out ${
                        cancelled
                          ? "bg-gradient-to-r from-orange-400 to-orange-500"
                          : "bg-gradient-to-r from-indigo-500 to-purple-500"
                      }`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-center gap-6 text-sm">
                    <span className="text-green-600">
                      新規: <span className="font-bold">{progress.inserted}</span>
                    </span>
                    <span className="text-blue-600">
                      更新: <span className="font-bold">{progress.updated}</span>
                    </span>
                  </div>
                  {/* ストップボタン */}
                  {loading && !cancelled && (
                    <div className="flex justify-center mt-2">
                      <button
                        onClick={handleStop}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        <StopCircle className="w-5 h-5" />
                        処理を中断
                      </button>
                    </div>
                  )}
                  {cancelled && (
                    <div className="text-center text-orange-600 text-sm font-medium">
                      処理が中断されました。{progress.current}件まで反映済みです。
                    </div>
                  )}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleUpload}
                  disabled={!file || !selectedConfig || loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      アップロード実行
                    </>
                  )}
                </button>
                {file && !loading && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all"
                  >
                    リセット
                  </button>
                )}
              </div>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">エラー</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            {/* 結果表示 */}
            {result && (
              <div
                className={`rounded-xl p-6 border ${
                  result.errors.length > 0
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-green-50 border-green-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.errors.length > 0 ? (
                    <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-lg text-gray-800">
                      アップロード完了
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      設定: {result.configName}
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                        <p className="text-sm text-gray-500">処理行数</p>
                        <p className="text-2xl font-bold text-gray-800">
                          {result.totalRows}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                        <p className="text-sm text-gray-500">新規登録</p>
                        <p className="text-2xl font-bold text-green-600">
                          {result.inserted}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                        <p className="text-sm text-gray-500">更新</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {result.updated}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                        <p className="text-sm text-gray-500">エラー</p>
                        <p className={`text-2xl font-bold ${result.errors.length > 0 ? "text-red-600" : "text-gray-400"}`}>
                          {result.errors.length}
                        </p>
                      </div>
                    </div>

                    {result.errors.length > 0 && (
                      <div className="mt-4">
                        <p className="font-medium text-yellow-700 mb-2">
                          エラー ({result.errors.length}件)
                        </p>
                        <div className="bg-white rounded-lg p-3 max-h-40 overflow-y-auto">
                          {result.errors.slice(0, 10).map((err, i) => (
                            <p key={i} className="text-sm text-red-600 mb-1">
                              {err}
                            </p>
                          ))}
                          {result.errors.length > 10 && (
                            <p className="text-sm text-gray-500 mt-2">
                              ...他 {result.errors.length - 10} 件
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 説明 */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3">アップロード仕様</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>
                    <strong>マッピング設定:</strong>{" "}
                    システム設定で作成したマッピング設定を使用
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>
                    <strong>キー項目:</strong>{" "}
                    マッピング設定で指定したキー項目で既存レコードを判定
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>
                    <strong>新規:</strong>{" "}
                    キー項目が存在しない場合は新規レコードとして追加
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>
                    <strong>更新:</strong>{" "}
                    キー項目が既に存在する場合は該当レコードを更新
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>
                    <strong>並列処理:</strong>{" "}
                    5件同時処理で高速化（従来比約5倍）
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
