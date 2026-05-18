"use client";

import { Download } from "lucide-react";

interface PDFViewerProps {
  fileUrl: string;
  title?: string;
}

export function PDFViewer({ fileUrl, title = "PDF" }: PDFViewerProps) {
  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* コントロールバー */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <h3 className="text-white font-medium">{title}</h3>
        <a
          href={fileUrl}
          download
          className="flex items-center px-3 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-white text-sm"
        >
          <Download className="w-4 h-4 mr-2" />
          ダウンロード
        </a>
      </div>

      {/* PDFコンテンツ（iframe使用） */}
      <div className="flex-1">
        <iframe
          src={fileUrl}
          className="w-full h-full border-0"
          title={title}
        />
      </div>
    </div>
  );
}
