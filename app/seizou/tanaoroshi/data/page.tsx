"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import {
  Upload,
  Trash2,
  Loader2,
  Database,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Archive,
} from "lucide-react";
import { MainLayout } from "@/components/layout";
import { parseStockFile, type ParsedStockFile } from "@/lib/tanaoroshi/stock-import";

const CHUNK = 500;
const PURGE_TARGETS = [
  { key: "stock", label: "システム在庫情報", desc: "基幹からの月次在庫。棚卸の突合対象" },
  { key: "result", label: "棚卸在庫情報", desc: "基幹連携出力（確定値の書き戻し先）" },
] as const;

/** 締め後にアーカイブ→初期化する棚卸稼働データ（F-15。上限2万件対策） */
// アーカイブ対象（実体データのある実績・差分。倉庫進捗は進捗キャッシュなので不要）
const WD_ARCHIVE = [
  { key: "entry", label: "棚卸_実績" },
  { key: "diff", label: "棚卸_差分リスト" },
] as const;
// 削除対象（この順で全件削除。confirmName はサーバ保護用にクライアントが自動送信）
const WD_PURGE = [
  { key: "entry", label: "棚卸_実績" },
  { key: "diff", label: "棚卸_差分リスト" },
  { key: "wh_status", label: "棚卸_倉庫進捗" },
] as const;

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(res.ok ? "サーバ応答の解析に失敗しました" : `通信エラー (${res.status})`);
  }
  if (!res.ok || json?.success === false) {
    const detail = Array.isArray(json?.issues) && json.issues.length ? `：${json.issues.join(" / ")}` : "";
    throw new Error((json?.error || `通信エラー (${res.status})`) + detail);
  }
  return json;
}

export default function TanaoroshiDataPage() {
  // ---- 取込 ----
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedStockFile | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProg, setImportProg] = useState({ done: 0, total: 0, phase: "" });
  const [importDone, setImportDone] = useState<string | null>(null);

  // ---- 初期化（参照テーブル） ----
  const [purgeKey, setPurgeKey] = useState<string>("");
  const [confirmName, setConfirmName] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeProg, setPurgeProg] = useState({ deleted: 0 });
  const [purgeMsg, setPurgeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ---- 締め後アーカイブ→初期化（F-15。ワンクリックで アーカイブDL→一括削除） ----
  const [wdRunning, setWdRunning] = useState(false);
  const [wdPhase, setWdPhase] = useState("");
  const [wdProg, setWdProg] = useState({ deleted: 0 });
  const [wdMsg, setWdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** アーカイブEXCELを取得してダウンロードさせる。件数を返す */
  const archiveOne = async (key: string): Promise<string> => {
    const res = await fetch(`/api/tanaoroshi/archive?table=${key}`);
    if (!res.ok) {
      const t = await res.text();
      let msg = `アーカイブに失敗しました (${res.status})`;
      try {
        msg = JSON.parse(t)?.error || msg;
      } catch {
        /* noop */
      }
      throw new Error(msg);
    }
    const total = res.headers.get("X-Total-Count") || "?";
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename\*=UTF-8''([^;]+)/);
    const fileName = m ? decodeURIComponent(m[1]) : `${key}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return total;
  };

  const runArchiveAndPurge = async () => {
    if (
      !window.confirm(
        "棚卸データ（実績・差分・倉庫進捗）をEXCELでアーカイブしてから全件削除します。\n" +
          "実施中の棚卸期がある場合は削除されません。\nよろしいですか？"
      )
    )
      return;
    setWdRunning(true);
    setWdMsg(null);
    setWdProg({ deleted: 0 });
    try {
      // 1) アーカイブ（監査保管用に必ずDL）
      for (const a of WD_ARCHIVE) {
        setWdPhase(`${a.label}をアーカイブ中…`);
        await archiveOne(a.key);
      }
      // 2) 一括削除（confirmName はサーバ保護用にクライアントが自動送信）
      let deleted = 0;
      for (const t of WD_PURGE) {
        setWdPhase(`${t.label}を削除中…`);
        for (;;) {
          const r = await postJson("/api/tanaoroshi/stock/purge", { table: t.key, confirmName: t.label });
          deleted += r.deleted || 0;
          setWdProg({ deleted });
          if (r.done) break;
        }
        await postJson("/api/tanaoroshi/stock/purge", { table: t.key, confirmName: t.label, done: { total: deleted } });
      }
      setWdMsg({ ok: true, text: `アーカイブ後、棚卸データを初期化しました（${deleted.toLocaleString()}件削除）` });
    } catch (e: any) {
      setWdMsg({ ok: false, text: e?.message || "初期化に失敗しました" });
    } finally {
      setWdRunning(false);
      setWdPhase("");
    }
  };

  const onPickFile = async (file: File) => {
    setParsed(null);
    setParseErr(null);
    setImportDone(null);
    try {
      const buf = await file.arrayBuffer();
      const p = parseStockFile(buf);
      if (p.headerIssues.length) {
        setParseErr(`列が想定と異なります：${p.headerIssues.slice(0, 5).join(" / ")}`);
        return;
      }
      if (p.rows.length === 0) {
        setParseErr("データ行がありません（ヘッダーのみのファイルです）");
        return;
      }
      setParsed(p);
    } catch (e: any) {
      setParseErr(e?.message || "ファイルの読み込みに失敗しました");
    }
  };

  const runImport = async () => {
    if (!parsed || parsed.rowIssueCount > 0) return; // 不正行があれば実行しない（削除前ガード）
    setImporting(true);
    setImportDone(null);
    setParseErr(null);
    try {
      const total = parsed.rows.length;
      const reqCount = Math.ceil(total / CHUNK);

      // 1) 洗い替えのため既存を全削除
      setImportProg({ done: 0, total, phase: "既存データを削除中" });
      let deleted = 0;
      for (;;) {
        const r = await postJson("/api/tanaoroshi/stock/purge", {
          table: "stock",
          confirmName: "システム在庫情報",
        });
        deleted += r.deleted || 0;
        setImportProg({ done: 0, total, phase: `既存データを削除中（${deleted}件）` });
        if (r.done) break;
      }

      // 2) 500件チャンクで登録（total=6000 なら 12リクエスト）
      let done = 0;
      for (let i = 0; i < total; i += CHUNK) {
        const chunk = parsed.rows.slice(i, i + CHUNK);
        await postJson("/api/tanaoroshi/stock/import", {
          header: parsed.header,
          rows: chunk,
          offset: i,
        });
        done += chunk.length;
        setImportProg({ done, total, phase: `取込中（${Math.ceil(done / CHUNK)}/${reqCount} 回）` });
      }

      // 3) 監査コミット
      await postJson("/api/tanaoroshi/stock/import", { header: parsed.header, done: { total } });

      setImportDone(`${total.toLocaleString()}件を取り込みました（既存 ${deleted.toLocaleString()}件を洗い替え）`);
      setParsed(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setParseErr(e?.message || "取込に失敗しました");
    } finally {
      setImporting(false);
      setImportProg({ done: 0, total: 0, phase: "" });
    }
  };

  const runPurge = async () => {
    const target = PURGE_TARGETS.find((t) => t.key === purgeKey);
    if (!target) return;
    setPurging(true);
    setPurgeMsg(null);
    setPurgeProg({ deleted: 0 });
    try {
      let deleted = 0;
      for (;;) {
        const r = await postJson("/api/tanaoroshi/stock/purge", { table: target.key, confirmName });
        deleted += r.deleted || 0;
        setPurgeProg({ deleted });
        if (r.done) break;
      }
      await postJson("/api/tanaoroshi/stock/purge", { table: target.key, confirmName, done: { total: deleted } });
      setPurgeMsg({ ok: true, text: `「${target.label}」を初期化しました（${deleted.toLocaleString()}件削除）` });
      setPurgeKey("");
      setConfirmName("");
    } catch (e: any) {
      setPurgeMsg({ ok: false, text: e?.message || "初期化に失敗しました" });
    } finally {
      setPurging(false);
    }
  };

  const selectedTarget = PURGE_TARGETS.find((t) => t.key === purgeKey);
  const confirmOk = selectedTarget && confirmName.trim() === selectedTarget.label;

  return (
    <MainLayout>
      <div className="h-full overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
          {/* ヘッダー */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow">
            <div className="flex items-center gap-3">
              <Database className="h-7 w-7" />
              <div>
                <h1 className="text-xl font-bold">棚卸データ管理</h1>
                <p className="text-sm text-blue-100">システム在庫情報の取込（洗い替え）・テーブル初期化</p>
              </div>
            </div>
          </div>

          {/* 取込 */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Upload className="h-5 w-5 text-blue-600" />
              システム在庫情報の取込
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              EXCEL（.xlsx）をアップロードすると、既存データを全削除してから取り込みます（洗い替え）。
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
              }}
            />

            {!parsed && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-6 w-6" />
                EXCELファイルを選択
              </button>
            )}

            {parseErr && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseErr}</span>
              </div>
            )}

            {parsed && (
              <div className="space-y-4">
                <div className="rounded-xl bg-blue-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-800">
                    <FileSpreadsheet className="h-4 w-4" />
                    読み込みプレビュー（シート: {parsed.sheetName}）
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <Stat label="データ行数" value={`${parsed.rows.length.toLocaleString()} 件`} />
                    <Stat label="倉庫数" value={`${parsed.warehouseCount} 倉庫`} />
                    <Stat label="送信回数" value={`約 ${Math.ceil(parsed.rows.length / CHUNK)} 回`} />
                  </div>
                </div>

                {parsed.rowIssueCount > 0 && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {parsed.rowIssueCount.toLocaleString()}件の不正な行があります。修正してから再度アップロードしてください。
                    </div>
                    <ul className="ml-6 list-disc text-xs">
                      {parsed.rowIssues.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                      {parsed.rowIssueCount > parsed.rowIssues.length && <li>ほか …</li>}
                    </ul>
                  </div>
                )}

                {importing ? (
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      {importProg.phase}
                      {importProg.total > 0 && importProg.done > 0 &&
                        ` … ${importProg.done.toLocaleString()} / ${importProg.total.toLocaleString()}`}
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: importProg.total ? `${(importProg.done / importProg.total) * 100}%` : "10%" }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      画面を閉じずにお待ちください。500件ごとに分割送信しています。
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={runImport}
                      disabled={parsed.rowIssueCount > 0}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Upload className="h-4 w-4" />
                      取り込む（洗い替え）
                    </button>
                    <button
                      onClick={() => {
                        setParsed(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="rounded-xl border border-gray-300 px-4 font-medium text-gray-600 hover:bg-gray-50"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            )}

            {importDone && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{importDone}</span>
              </div>
            )}
          </section>

          {/* 初期化 */}
          <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Trash2 className="h-5 w-5 text-red-600" />
              テーブル初期化
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              選択したテーブルの全レコードを削除します。<span className="font-medium text-red-600">元に戻せません。</span>
            </p>

            <div className="space-y-3">
              {PURGE_TARGETS.map((t) => (
                <label
                  key={t.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                    purgeKey === t.key ? "border-red-400 bg-red-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="purge"
                    className="mt-1"
                    checked={purgeKey === t.key}
                    onChange={() => {
                      setPurgeKey(t.key);
                      setConfirmName("");
                      setPurgeMsg(null);
                    }}
                    disabled={purging}
                  />
                  <div>
                    <div className="font-medium text-gray-800">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {selectedTarget && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  確認のため、対象テーブル名 <span className="font-mono font-semibold">{selectedTarget.label}</span> を入力してください。
                </div>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={selectedTarget.label}
                  disabled={purging}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
                <button
                  onClick={runPurge}
                  disabled={!confirmOk || purging}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {purging ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      初期化中 … {purgeProg.deleted.toLocaleString()}件削除
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      初期化する
                    </>
                  )}
                </button>
              </div>
            )}

            {purgeMsg && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${
                  purgeMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {purgeMsg.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{purgeMsg.text}</span>
              </div>
            )}
          </section>

          {/* 締め後アーカイブ→初期化（F-15: 上限2万件対策） */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Archive className="h-5 w-5 text-indigo-600" />
              棚卸データのアーカイブと初期化（締め後）
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              棚卸実績はテーブル上限（2万件）に達するため、締め後に実行してください。ボタン1つで
              <span className="font-medium text-indigo-700">実績・差分をEXCELでダウンロード</span>
              してから、棚卸_実績・差分リスト・倉庫進捗を全件削除します。
              <span className="text-gray-400">（実施中の棚卸期があるときは削除されません）</span>
            </p>

            {wdRunning ? (
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm text-gray-700">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  {wdPhase}
                  {wdProg.deleted > 0 && ` … ${wdProg.deleted.toLocaleString()}件削除`}
                </div>
                <p className="text-xs text-gray-400">
                  EXCELが2つダウンロードされます。ブラウザの複数ファイル許可が出たら「許可」してください。
                </p>
              </div>
            ) : (
              <button
                onClick={runArchiveAndPurge}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
              >
                <Archive className="h-4 w-4" />
                アーカイブして初期化
              </button>
            )}

            {wdMsg && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm ${
                  wdMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                {wdMsg.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{wdMsg.text}</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-800">{value}</div>
    </div>
  );
}
