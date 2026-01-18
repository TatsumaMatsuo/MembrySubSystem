"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout";
import {
  Link2,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Check,
  X,
  Edit2,
  Loader2,
  ChevronDown,
  Key,
} from "lucide-react";
import { DataMappingConfig, FieldMapping, LarkTableField } from "@/types/data-mapping";

interface LarkFieldWithType extends LarkTableField {
  fieldType: "text" | "number" | "date";
}

export default function DataMappingPage() {
  // 設定一覧
  const [configs, setConfigs] = useState<DataMappingConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);

  // 編集中の設定
  const [editMode, setEditMode] = useState<"new" | "edit" | null>(null);
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [tableId, setTableId] = useState("");
  const [baseToken, setBaseToken] = useState("");
  const [keyField, setKeyField] = useState("");

  // Larkフィールド
  const [larkFields, setLarkFields] = useState<LarkFieldWithType[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  // Excelヘッダー
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [loadingExcel, setLoadingExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // マッピング
  const [mappings, setMappings] = useState<FieldMapping[]>([]);

  // 状態
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 設定一覧を読み込み
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/data-mapping");
      const data = await response.json();
      if (response.ok) {
        setConfigs(data.configs || []);
      } else {
        setError(data.error || "設定の読み込みに失敗しました");
      }
    } catch (err) {
      setError("設定の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Larkフィールドを取得
  const fetchLarkFields = async () => {
    if (!tableId) {
      setFieldsError("テーブルIDを入力してください");
      return;
    }

    setLoadingFields(true);
    setFieldsError(null);
    try {
      const params = new URLSearchParams({ tableId });
      if (baseToken) {
        params.append("baseToken", baseToken);
      }
      const response = await fetch(`/api/settings/data-mapping/fields?${params}`);
      const data = await response.json();

      if (response.ok) {
        setLarkFields(data.fields || []);
        // 既存のマッピングで使用されているフィールドが存在するかチェック
        if (data.fields.length === 0) {
          setFieldsError("フィールドが見つかりませんでした");
        }
      } else {
        setFieldsError(data.error || "フィールドの取得に失敗しました");
      }
    } catch (err) {
      setFieldsError("フィールドの取得に失敗しました");
    } finally {
      setLoadingFields(false);
    }
  };

  // Excelヘッダーを取得
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingExcel(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/settings/data-mapping/excel-headers", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setExcelHeaders(data.headers || []);
        setExcelFileName(data.fileName);
      } else {
        setError(data.error || "Excelの解析に失敗しました");
      }
    } catch (err) {
      setError("Excelの解析に失敗しました");
    } finally {
      setLoadingExcel(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // マッピングを追加
  const addMapping = (larkField: string) => {
    if (mappings.some((m) => m.larkField === larkField)) return;

    const field = larkFields.find((f) => f.field_name === larkField);
    setMappings([
      ...mappings,
      {
        larkField,
        excelColumn: "",
        fieldType: field?.fieldType || "text",
      },
    ]);
  };

  // マッピングのExcelカラムを変更
  const updateMappingExcel = (larkField: string, excelColumn: string) => {
    setMappings(
      mappings.map((m) =>
        m.larkField === larkField ? { ...m, excelColumn } : m
      )
    );
  };

  // マッピングを削除
  const removeMapping = (larkField: string) => {
    setMappings(mappings.filter((m) => m.larkField !== larkField));
  };

  // 新規作成モードを開始
  const startNewConfig = () => {
    setEditMode("new");
    setSelectedConfigId(null);
    setConfigName("");
    setConfigDescription("");
    setTableId("");
    setBaseToken("");
    setKeyField("");
    setLarkFields([]);
    setExcelHeaders([]);
    setExcelFileName("");
    setMappings([]);
    setError(null);
    setFieldsError(null);
  };

  // 既存設定を編集
  const editConfig = (config: DataMappingConfig) => {
    setEditMode("edit");
    setSelectedConfigId(config.id);
    setConfigName(config.name);
    setConfigDescription(config.description || "");
    setTableId(config.tableId);
    setBaseToken(config.baseToken || "");
    setKeyField(config.keyField);
    setMappings(config.mappings);
    setLarkFields([]);
    setExcelHeaders([]);
    setExcelFileName("");
    setError(null);
    setFieldsError(null);
  };

  // 設定を保存
  const saveConfig = async () => {
    if (!configName) {
      setError("設定名を入力してください");
      return;
    }
    if (!tableId) {
      setError("テーブルIDを入力してください");
      return;
    }
    if (!keyField) {
      setError("キー項目を選択してください");
      return;
    }
    if (mappings.length === 0) {
      setError("少なくとも1つのマッピングを設定してください");
      return;
    }
    // マッピングのExcelカラムが設定されているかチェック
    const incompleteMappings = mappings.filter((m) => !m.excelColumn);
    if (incompleteMappings.length > 0) {
      setError("すべてのマッピングにExcelカラムを設定してください");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        id: editMode === "edit" ? selectedConfigId : undefined,
        name: configName,
        description: configDescription,
        tableId,
        baseToken: baseToken || undefined,
        keyField,
        mappings,
      };

      const response = await fetch("/api/settings/data-mapping", {
        method: editMode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(
          editMode === "edit" ? "設定を更新しました" : "設定を作成しました"
        );
        await loadConfigs();
        setEditMode(null);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || "保存に失敗しました");
      }
    } catch (err) {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 設定を削除
  const deleteConfig = async (id: string) => {
    if (!confirm("この設定を削除しますか？")) return;

    try {
      const response = await fetch(`/api/settings/data-mapping?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccessMessage("設定を削除しました");
        await loadConfigs();
        if (selectedConfigId === id) {
          setEditMode(null);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "削除に失敗しました");
      }
    } catch (err) {
      setError("削除に失敗しました");
    }
  };

  // キャンセル
  const cancelEdit = () => {
    setEditMode(null);
    setError(null);
    setFieldsError(null);
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 overflow-hidden">
        {/* ページタイトル */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-500" />
            データマッピング設定
          </h1>
          <p className="text-sm text-gray-500">
            システム設定 &gt; データマッピング
          </p>
        </div>

        {/* メインコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 成功メッセージ */}
            {successMessage && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <span className="text-green-700">{successMessage}</span>
              </div>
            )}

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" />
                <span className="text-red-700">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 設定一覧（左サイド） */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-800">設定一覧</h2>
                  <button
                    onClick={startNewConfig}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    新規
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : configs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>設定がありません</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {configs.map((config) => (
                      <div
                        key={config.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedConfigId === config.id
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                        }`}
                        onClick={() => editConfig(config)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-800">
                              {config.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              テーブル: {config.tableId.slice(0, 10)}...
                            </p>
                            <p className="text-xs text-gray-500">
                              マッピング: {config.mappings.length}項目
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConfig(config.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 編集エリア（右サイド） */}
              <div className="lg:col-span-2 space-y-6">
                {editMode ? (
                  <>
                    {/* 基本設定 */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <h2 className="text-base font-bold text-gray-800 mb-4">
                        {editMode === "new" ? "新規設定" : "設定編集"}
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            設定名 <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={configName}
                            onChange={(e) => setConfigName(e.target.value)}
                            placeholder="例: 受注残情報"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            説明
                          </label>
                          <input
                            type="text"
                            value={configDescription}
                            onChange={(e) => setConfigDescription(e.target.value)}
                            placeholder="任意の説明文"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            テーブルID <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tableId}
                              onChange={(e) => setTableId(e.target.value)}
                              placeholder="tbl..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <button
                              onClick={fetchLarkFields}
                              disabled={loadingFields || !tableId}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                            >
                              {loadingFields ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Base Token（省略時はデフォルト）
                          </label>
                          <input
                            type="text"
                            value={baseToken}
                            onChange={(e) => setBaseToken(e.target.value)}
                            placeholder="省略可"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    {/* マッピング設定 */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                      <h2 className="text-base font-bold text-gray-800 mb-4">
                        フィールドマッピング
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Larkフィールド（左側） */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-700">
                              Larkテーブル項目
                            </h3>
                            <span className="text-xs text-gray-500">
                              {larkFields.length}項目
                            </span>
                          </div>

                          {fieldsError && (
                            <div className="text-sm text-red-500 mb-2">
                              {fieldsError}
                            </div>
                          )}

                          <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
                            {larkFields.length === 0 ? (
                              <div className="p-4 text-center text-gray-500">
                                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">
                                  テーブルIDを入力して更新ボタンを押してください
                                </p>
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {larkFields.map((field) => {
                                  const isMapped = mappings.some(
                                    (m) => m.larkField === field.field_name
                                  );
                                  const isKeyField = keyField === field.field_name;
                                  return (
                                    <div
                                      key={field.field_id}
                                      className={`p-2 flex items-center justify-between ${
                                        isMapped
                                          ? "bg-indigo-50"
                                          : "hover:bg-gray-50"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-800">
                                          {field.field_name}
                                        </span>
                                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                          {field.fieldType}
                                        </span>
                                        {isKeyField && (
                                          <Key className="w-3 h-3 text-amber-500" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {!isKeyField && (
                                          <button
                                            onClick={() =>
                                              setKeyField(field.field_name)
                                            }
                                            className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                                            title="キー項目に設定"
                                          >
                                            <Key className="w-4 h-4" />
                                          </button>
                                        )}
                                        {!isMapped && (
                                          <button
                                            onClick={() =>
                                              addMapping(field.field_name)
                                            }
                                            className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                                            title="マッピングに追加"
                                          >
                                            <Plus className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Excelヘッダー（右側） */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-700">
                              Excelカラム
                            </h3>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handleExcelUpload}
                              className="hidden"
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={loadingExcel}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            >
                              {loadingExcel ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3" />
                              )}
                              Excelアップロード
                            </button>
                          </div>

                          {excelFileName && (
                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                              <FileSpreadsheet className="w-3 h-3" />
                              {excelFileName} ({excelHeaders.length}カラム)
                            </div>
                          )}

                          <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
                            {excelHeaders.length === 0 ? (
                              <div className="p-4 text-center text-gray-500">
                                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">
                                  サンプルExcelをアップロードしてカラム一覧を取得
                                </p>
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {excelHeaders.map((header, index) => (
                                  <div
                                    key={index}
                                    className="p-2 text-sm text-gray-800 hover:bg-gray-50"
                                  >
                                    {header}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* マッピング一覧 */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-gray-700">
                            マッピング一覧
                          </h3>
                          <span className="text-xs text-gray-500">
                            {mappings.length}件
                          </span>
                        </div>

                        {keyField && (
                          <div className="text-sm text-amber-600 mb-2 flex items-center gap-1">
                            <Key className="w-4 h-4" />
                            キー項目: {keyField}
                          </div>
                        )}

                        {mappings.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                            <p className="text-sm">
                              左側のLarkフィールドから＋ボタンでマッピングを追加してください
                            </p>
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                            {mappings.map((mapping) => (
                              <div
                                key={mapping.larkField}
                                className="p-3 flex items-center gap-3"
                              >
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-800">
                                    {mapping.larkField}
                                  </span>
                                  <span className="text-xs ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                    {mapping.fieldType}
                                  </span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <div className="flex-1">
                                  {excelHeaders.length > 0 ? (
                                    <select
                                      value={mapping.excelColumn}
                                      onChange={(e) =>
                                        updateMappingExcel(
                                          mapping.larkField,
                                          e.target.value
                                        )
                                      }
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                      <option value="">-- 選択 --</option>
                                      {excelHeaders.map((header, index) => (
                                        <option key={index} value={header}>
                                          {header}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={mapping.excelColumn}
                                      onChange={(e) =>
                                        updateMappingExcel(
                                          mapping.larkField,
                                          e.target.value
                                        )
                                      }
                                      placeholder="Excelカラム名"
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                  )}
                                </div>
                                <button
                                  onClick={() => removeMapping(mapping.larkField)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={saveConfig}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            保存
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl shadow-lg p-12 border border-gray-100 text-center">
                    <Link2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">
                      左側の設定一覧から選択するか、新規ボタンで作成してください
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </MainLayout>
  );
}
