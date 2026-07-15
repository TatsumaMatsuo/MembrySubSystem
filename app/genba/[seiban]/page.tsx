"use client";

// F2-10 外注業者向け 現場作業日報ページ(認証不要)
//
// 案件別URL `/genba/<製番>?code=<受付コード>` で到達。受付コードを /api/genba で照合し、
// 最小情報(物件名/施工場所/施工業者/担当営業)を read-only 表示 + 日報フォームへの導線を出す。
// 売約データの閲覧・編集は不可(表示は最小限のみ)。
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { HardHat, ExternalLink, Loader2, AlertCircle } from "lucide-react";

interface GenbaData {
  seiban: string;
  code: string;
  bukken: string;
  location: string;
  salesPerson: string;
  contractor: string;
  formUrl: string;
}

export default function GenbaPage({ params }: { params: { seiban: string } }) {
  const seiban = decodeURIComponent(params.seiban);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GenbaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code") || "";
    (async () => {
      try {
        const res = await fetch(
          `/api/genba?seiban=${encodeURIComponent(seiban)}&code=${encodeURIComponent(code)}`
        );
        const json = await res.json();
        if (json.ok) setData(json as GenbaData);
        else setError(json.message || "URLが無効です。");
      } catch {
        setError("通信に失敗しました。電波状況をご確認のうえ、再度お試しください。");
      } finally {
        setLoading(false);
      }
    })();
  }, [seiban]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <HardHat className="w-7 h-7 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-800">現場作業日報</h1>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 flex items-center justify-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-3">読み込み中...</span>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-gray-700">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-xs text-gray-400 mb-3">この案件の日報を投稿できます</p>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-20 flex-none">物件名</dt>
                  <dd className="font-medium text-gray-800">{data.bukken || "-"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-20 flex-none">施工場所</dt>
                  <dd className="font-medium text-gray-800">{data.location || "-"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-20 flex-none">施工業者</dt>
                  <dd className="font-medium text-gray-800">{data.contractor || "-"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-20 flex-none">担当営業</dt>
                  <dd className="font-medium text-gray-800">{data.salesPerson || "-"}</dd>
                </div>
              </dl>
            </div>

            <a
              href={data.formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-500 py-3.5 text-white font-semibold shadow hover:bg-amber-600 active:translate-y-px"
            >
              日報を入力する
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* フォームで prefill が効かない場合の手入力フォールバック */}
            <div className="bg-white rounded-xl shadow p-4 text-xs text-gray-500">
              <p className="mb-1.5">フォームで入力を求められた場合は、以下を入力してください:</p>
              <p>
                売約番号: <span className="font-mono text-gray-800">{data.seiban}</span>
              </p>
              <p>
                受付コード: <span className="font-mono text-gray-800">{data.code}</span>
              </p>
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-gray-400">
          このページは日報投稿専用です。他の案件情報は表示されません。
        </p>
      </div>
    </div>
  );
}
