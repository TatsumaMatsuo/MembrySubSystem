"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";

function PdfViewerContent() {
  const searchParams = useSearchParams();
  const fileToken = searchParams.get("file_token") || "";
  const fileName = searchParams.get("name") || "file.pdf";
  const source = searchParams.get("source") || "";

  const proxyUrl = `/api/file/proxy?file_token=${encodeURIComponent(fileToken)}&name=${encodeURIComponent(fileName)}${source ? `&source=${source}` : ""}`;
  const downloadUrl = `${proxyUrl}&disposition=attachment`;

  if (!fileToken) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-lg">ファイルトークンが指定されていません</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* ヘッダー */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="text-sm font-medium text-gray-200 truncate max-w-[70%]">
          {fileName}
        </h1>
        <a
          href={downloadUrl}
          className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          ダウンロード
        </a>
      </div>
      {/* PDF表示 */}
      <iframe
        src={proxyUrl}
        className="flex-1 w-full border-0"
        title={fileName}
      />
    </div>
  );
}

export default function PdfViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-gray-900">
          <p className="text-gray-400">読み込み中...</p>
        </div>
      }
    >
      <PdfViewerContent />
    </Suspense>
  );
}
