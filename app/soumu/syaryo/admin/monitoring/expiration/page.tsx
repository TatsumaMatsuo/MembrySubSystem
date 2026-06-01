"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  AlertCircle,
  FileText,
  Car,
  Shield,
  RefreshCw,
  Play,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Send,
  Mail,
  MailX,
} from "lucide-react";

interface ExpirationItem {
  type: "license" | "vehicle" | "insurance";
  documentId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  documentNumber: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

interface ExpirationSettings {
  licenseWarningDays: number;
  vehicleWarningDays: number;
  insuranceWarningDays: number;
  adminEscalationDays: number;
}

interface ExpirationSummary {
  expiringCount: number;
  expiredCount: number;
  expiringByType: {
    license: number;
    vehicle: number;
    insurance: number;
  };
  expiredByType: {
    license: number;
    vehicle: number;
    insurance: number;
  };
  expiringList?: ExpirationItem[];
  expiredList?: ExpirationItem[];
  settings?: ExpirationSettings;
}

const itemKey = (item: ExpirationItem) => `${item.type}-${item.documentId}`;

const getTypeIcon = (type: string) => {
  switch (type) {
    case "license":
      return <FileText className="w-5 h-5 text-blue-600" />;
    case "vehicle":
      return <Car className="w-5 h-5 text-green-600" />;
    case "insurance":
      return <Shield className="w-5 h-5 text-purple-600" />;
    default:
      return null;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "license":
      return "免許証";
    case "vehicle":
      return "車検証";
    case "insurance":
      return "任意保険";
    default:
      return type;
  }
};

/**
 * 明細パネル（期限切れ間近／期限切れ共通）
 * チェックボックスで対象を選択し、まとめてリマインドメッセージを送信できる
 */
function DetailPanel({
  items,
  category,
  selected,
  onToggle,
  onToggleAll,
  note,
  onNoteChange,
  onSend,
  sending,
}: {
  items: ExpirationItem[];
  category: "expiring" | "expired";
  selected: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  note: string;
  onNoteChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const isExpired = category === "expired";
  const selectableCount = items.filter((i) => i.employeeEmail).length;
  const selectedCount = selected.size;
  const allSelected = selectableCount > 0 && selectedCount >= selectableCount;

  const headerClass = isExpired
    ? "bg-red-50 border-red-200"
    : "bg-orange-50 border-orange-200";
  const rowHover = isExpired ? "hover:bg-red-50" : "hover:bg-orange-50";
  const badgeClass = isExpired
    ? "bg-red-100 text-red-800"
    : "bg-orange-100 text-orange-800";
  const checkboxAccent = isExpired ? "accent-red-600" : "accent-orange-600";
  const sendBtnClass = isExpired
    ? "bg-red-600 hover:bg-red-700"
    : "bg-orange-600 hover:bg-orange-700";

  return (
    <div className="border-t border-gray-200">
      {/* 操作バー */}
      <div className={`px-6 py-3 flex flex-wrap items-center gap-3 border-b ${headerClass}`}>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className={`w-4 h-4 ${checkboxAccent}`}
            checked={allSelected}
            onChange={onToggleAll}
            disabled={selectableCount === 0}
          />
          すべて選択
        </label>
        <span className="text-sm text-gray-600">
          {selectedCount} / {selectableCount} 件選択中
        </span>
        <button
          onClick={onSend}
          disabled={selectedCount === 0 || sending}
          className={`ml-auto inline-flex items-center px-4 py-2 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sendBtnClass}`}
        >
          <Send className="w-4 h-4 mr-2" />
          {sending ? "送信中..." : "選択した社員にメッセージを送信"}
        </button>
      </div>

      {/* 任意の連絡文 */}
      <div className="px-6 py-3 border-b border-gray-100">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          追加メッセージ（任意・送信本文の末尾に追記されます）
        </label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          placeholder="例）至急、更新後の書類をご提出ください。ご不明点は総務までご連絡ください。"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-y"
        />
      </div>

      {/* 明細リスト */}
      <div className="divide-y divide-gray-200">
        {items.map((item, index) => {
          const key = itemKey(item);
          const hasEmail = !!item.employeeEmail;
          const checked = selected.has(key);
          return (
            <div
              key={`${key}-${index}`}
              className={`px-6 py-4 transition-colors ${rowHover} ${
                checked ? (isExpired ? "bg-red-50" : "bg-orange-50") : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    className={`w-4 h-4 ${checkboxAccent} disabled:opacity-40`}
                    checked={checked}
                    onChange={() => onToggle(key)}
                    disabled={!hasEmail}
                    title={hasEmail ? "" : "メールアドレス未登録のため送信できません"}
                  />
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {getTypeLabel(item.type)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.documentNumber}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                      <span className="flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        {item.employeeName}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(item.expirationDate).toLocaleDateString("ja-JP")}
                      </span>
                      {hasEmail ? (
                        <span className="flex items-center text-gray-400">
                          <Mail className="w-4 h-4 mr-1" />
                          {item.employeeEmail}
                        </span>
                      ) : (
                        <span className="flex items-center text-red-500">
                          <MailX className="w-4 h-4 mr-1" />
                          メール未登録（送信不可）
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badgeClass}`}
                  >
                    {isExpired
                      ? `${Math.abs(item.daysUntilExpiration)} 日超過`
                      : `残り ${item.daysUntilExpiration} 日`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExpirationMonitoringPage() {
  const [summary, setSummary] = useState<ExpirationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // 明細パネルの開閉
  const [showExpiring, setShowExpiring] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  // 選択状態（key = `${type}-${documentId}`）
  const [selectedExpiring, setSelectedExpiring] = useState<Set<string>>(new Set());
  const [selectedExpired, setSelectedExpired] = useState<Set<string>>(new Set());

  // 追加メッセージ
  const [expiringNote, setExpiringNote] = useState("");
  const [expiredNote, setExpiredNote] = useState("");

  // 送信中フラグ
  const [sendingExpiring, setSendingExpiring] = useState(false);
  const [sendingExpired, setSendingExpired] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/syaryo/monitoring/expiration");
      const data = await response.json();

      if (data.success) {
        setSummary(data.data);
        // リフレッシュ時は選択状態をクリア
        setSelectedExpiring(new Set());
        setSelectedExpired(new Set());
      }
    } catch (error) {
      console.error("Failed to fetch expiration summary:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRunMonitor = async () => {
    if (!confirm("有効期限監視ジョブを手動実行しますか？")) return;

    setRunning(true);
    try {
      const response = await fetch("/api/syaryo/monitoring/expiration/run", {
        method: "POST",
      });

      if (response.ok) {
        alert("監視ジョブを開始しました。通知が送信されます。");
        setTimeout(() => {
          fetchSummary();
        }, 5000);
      } else {
        throw new Error("Failed to run monitor");
      }
    } catch (error) {
      console.error("Failed to run monitor:", error);
      alert("監視ジョブの実行に失敗しました");
    } finally {
      setRunning(false);
    }
  };

  // チェックボックスのトグル
  const toggleSelection = (
    category: "expiring" | "expired",
    key: string
  ) => {
    const setter = category === "expiring" ? setSelectedExpiring : setSelectedExpired;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // すべて選択／解除（メール登録済みのみ）
  const toggleSelectAll = (category: "expiring" | "expired") => {
    const list =
      (category === "expiring" ? summary?.expiringList : summary?.expiredList) || [];
    const selectable = list.filter((i) => i.employeeEmail);
    const setter = category === "expiring" ? setSelectedExpiring : setSelectedExpired;
    const current = category === "expiring" ? selectedExpiring : selectedExpired;
    const allSelected = selectable.length > 0 && current.size >= selectable.length;
    setter(allSelected ? new Set() : new Set(selectable.map(itemKey)));
  };

  // メッセージ送信
  const handleSend = async (category: "expiring" | "expired") => {
    const list =
      (category === "expiring" ? summary?.expiringList : summary?.expiredList) || [];
    const selected = category === "expiring" ? selectedExpiring : selectedExpired;
    const note = category === "expiring" ? expiringNote : expiredNote;
    const targets = list.filter((i) => selected.has(itemKey(i)));

    if (targets.length === 0) {
      alert("送信対象を選択してください");
      return;
    }

    if (
      !confirm(
        `選択した ${targets.length} 件の社員にリマインドメッセージを送信します。よろしいですか？`
      )
    ) {
      return;
    }

    const setSending = category === "expiring" ? setSendingExpiring : setSendingExpired;
    setSending(true);
    try {
      const response = await fetch("/api/syaryo/monitoring/expiration/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, note, items: targets }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "送信に失敗しました");
      }

      const failedDetails = (data.details || []).filter((d: any) => !d.ok);
      let message = `送信完了: 成功 ${data.sent} 件 / 失敗 ${data.failed} 件`;
      if (failedDetails.length > 0) {
        message +=
          "\n\n【失敗】\n" +
          failedDetails
            .map((d: any) => `・${d.employeeName}（${d.documentNumber}）: ${d.reason || "不明なエラー"}`)
            .join("\n");
      }
      alert(message);

      // 選択クリア
      const setter = category === "expiring" ? setSelectedExpiring : setSelectedExpired;
      setter(new Set());
    } catch (error) {
      console.error("Failed to send messages:", error);
      alert(
        `メッセージ送信に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <AlertTriangle className="h-8 w-8 mr-3 text-orange-600" />
                有効期限監視
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                システム設定の警告日数に基づき有効期限を監視します
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={fetchSummary}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-5 h-5 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                更新
              </button>
              <button
                onClick={handleRunMonitor}
                disabled={running}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <Play className="w-5 h-5 mr-2" />
                {running ? "実行中..." : "手動実行"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* サマリーカード */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && !summary ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* 概要カード（クリックで明細を開閉） */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 期限切れ間近 */}
              <button
                type="button"
                onClick={() => setShowExpiring((v) => !v)}
                className={`text-left bg-white rounded-lg shadow p-6 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  showExpiring ? "ring-2 ring-orange-400" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <AlertTriangle className="h-8 w-8 text-orange-600 mr-3" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        期限切れ間近
                      </h2>
                      <p className="text-sm text-gray-600">
                        設定日数以内に期限が切れる書類
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-orange-600">
                      {summary.expiringCount}
                    </div>
                    {summary.expiringCount > 0 &&
                      (showExpiring ? (
                        <ChevronUp className="w-6 h-6 text-orange-600" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-orange-600" />
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(summary.expiringByType).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-2 bg-orange-50 rounded"
                    >
                      <div className="flex items-center">
                        {getTypeIcon(type)}
                        <span className="ml-2 text-sm font-medium">
                          {getTypeLabel(type)}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-orange-600">
                        {count}件
                      </span>
                    </div>
                  ))}
                </div>
                {summary.expiringCount > 0 && (
                  <p className="mt-3 text-xs text-orange-600 font-medium">
                    クリックで明細を{showExpiring ? "閉じる" : "表示"}
                  </p>
                )}
              </button>

              {/* 期限切れ */}
              <button
                type="button"
                onClick={() => setShowExpired((v) => !v)}
                className={`text-left bg-white rounded-lg shadow p-6 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 ${
                  showExpired ? "ring-2 ring-red-400" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        期限切れ
                      </h2>
                      <p className="text-sm text-gray-600">
                        有効期限が切れている書類
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-red-600">
                      {summary.expiredCount}
                    </div>
                    {summary.expiredCount > 0 &&
                      (showExpired ? (
                        <ChevronUp className="w-6 h-6 text-red-600" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-red-600" />
                      ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(summary.expiredByType).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-2 bg-red-50 rounded"
                    >
                      <div className="flex items-center">
                        {getTypeIcon(type)}
                        <span className="ml-2 text-sm font-medium">
                          {getTypeLabel(type)}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-red-600">
                        {count}件
                      </span>
                    </div>
                  ))}
                </div>
                {summary.expiredCount > 0 && (
                  <p className="mt-3 text-xs text-red-600 font-medium">
                    クリックで明細を{showExpired ? "閉じる" : "表示"}
                  </p>
                )}
              </button>
            </div>

            {/* 期限切れ間近 明細 */}
            {showExpiring && summary.expiringCount > 0 && summary.expiringList && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-orange-600 flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    期限切れ間近の書類一覧
                  </h3>
                </div>
                <DetailPanel
                  items={summary.expiringList}
                  category="expiring"
                  selected={selectedExpiring}
                  onToggle={(key) => toggleSelection("expiring", key)}
                  onToggleAll={() => toggleSelectAll("expiring")}
                  note={expiringNote}
                  onNoteChange={setExpiringNote}
                  onSend={() => handleSend("expiring")}
                  sending={sendingExpiring}
                />
              </div>
            )}

            {/* 期限切れ 明細 */}
            {showExpired && summary.expiredCount > 0 && summary.expiredList && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-red-600 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    期限切れの書類一覧
                  </h3>
                </div>
                <DetailPanel
                  items={summary.expiredList}
                  category="expired"
                  selected={selectedExpired}
                  onToggle={(key) => toggleSelection("expired", key)}
                  onToggleAll={() => toggleSelectAll("expired")}
                  note={expiredNote}
                  onNoteChange={setExpiredNote}
                  onSend={() => handleSend("expired")}
                  sending={sendingExpired}
                />
              </div>
            )}

            {/* 通知設定情報 */}
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    有効期限警告設定（システム設定より）
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>• 免許証: 期限 <strong>{summary.settings?.licenseWarningDays || 30}日前</strong> から警告</p>
                    <p>• 車検証: 期限 <strong>{summary.settings?.vehicleWarningDays || 30}日前</strong> から警告</p>
                    <p>• 任意保険: 期限 <strong>{summary.settings?.insuranceWarningDays || 30}日前</strong> から警告</p>
                    <p>• 管理者通知: 期限切れ後 <strong>{summary.settings?.adminEscalationDays || 7}日</strong> でエスカレーション</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">データを取得できませんでした</p>
          </div>
        )}
      </main>
    </div>
  );
}
