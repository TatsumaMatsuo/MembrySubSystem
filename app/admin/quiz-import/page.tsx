"use client";

import { useState } from "react";

export default function QuizImportPage() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ success: 0, failed: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [quizFile, setQuizFile] = useState<File | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQuizFile(file);
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      setQuizzes(data);
      setMessage(`${data.length}問のクイズを読み込みました`);
    } catch (error) {
      setMessage("JSONファイルの解析に失敗しました");
    }
  };

  const handleImport = async () => {
    if (quizzes.length === 0) {
      setMessage("クイズデータを読み込んでください");
      return;
    }

    setImporting(true);
    setProgress({ success: 0, failed: 0, total: quizzes.length });

    // バッチ処理（50件ずつ）
    const batchSize = 50;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < quizzes.length; i += batchSize) {
      const batch = quizzes.slice(i, i + batchSize);

      try {
        const response = await fetch("/api/quiz/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizzes: batch }),
        });

        const result = await response.json();

        if (result.success) {
          success += result.data.success;
          failed += result.data.failed;
        } else {
          failed += batch.length;
        }
      } catch (error) {
        failed += batch.length;
      }

      setProgress({ success, failed, total: quizzes.length });
    }

    setImporting(false);
    setMessage(`インポート完了: 成功 ${success}件, 失敗 ${failed}件`);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">クイズデータインポート</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-blue-800">500問のクイズデータをダウンロード</h2>
        <p className="text-blue-600 mb-4">membry.jpの情報から作成した500問のクイズデータをダウンロードできます。</p>
        <a
          href="/data/all-quizzes.json"
          download="all-quizzes.json"
          className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          クイズデータをダウンロード (500問)
        </a>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">JSONファイルを選択してインポート</h2>
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {quizzes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">インポート準備完了</h2>
          <p className="text-gray-600 mb-4">{quizzes.length}問のクイズをインポートします</p>
          <button
            onClick={handleImport}
            disabled={importing}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {importing ? "インポート中..." : "インポート開始"}
          </button>
        </div>
      )}

      {importing && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">進捗状況</h2>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className="bg-blue-500 h-4 rounded-full transition-all duration-300"
              style={{ width: `${((progress.success + progress.failed) / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-gray-600">
            成功: {progress.success} / 失敗: {progress.failed} / 全体: {progress.total}
          </p>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-lg ${message.includes("失敗") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}
    </div>
  );
}
