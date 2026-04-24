"use client";

import { useState } from "react";
import { FileText, Download, X } from "lucide-react";
import { LarkAttachment } from "@/types/syaryo";

interface AttachmentViewerProps {
  /** 添付ファイル（配列または単体） */
  attachment: LarkAttachment | LarkAttachment[] | undefined | null;
  /** タイトル */
  title?: string;
  /** 高さのクラス（デフォルト: h-40） */
  heightClass?: string;
  /** クリックで拡大モーダルを表示するか */
  enableModal?: boolean;
  /** アスペクト比クラス（heightClassより優先） */
  aspectClass?: string;
}

// 添付ファイルからファイル情報を取得
function getAttachmentInfo(attachment: LarkAttachment | LarkAttachment[] | undefined | null): {
  url: string | null;
  isPdf: boolean;
  filename: string | null;
} {
  if (!attachment) return { url: null, isPdf: false, filename: null };

  const att = Array.isArray(attachment) ? attachment[0] : attachment;
  if (!att?.file_token) return { url: null, isPdf: false, filename: null };

  // URL構築（urlを優先、tmp_urlは一時URL取得APIなので使用しない）
  const baseUrl = `/api/attachments/${att.file_token}`;
  const downloadUrl = att.url; // tmp_urlではなくurlを使用
  const url = downloadUrl ? `${baseUrl}?url=${encodeURIComponent(downloadUrl)}` : baseUrl;

  // PDF判定（typeフィールドまたはファイル名で判定）
  const isPdf =
    (att.type && att.type.includes("pdf")) ||
    (att.name && att.name.toLowerCase().endsWith(".pdf"));

  return { url, isPdf: !!isPdf, filename: att.name || null };
}

/**
 * 添付ファイル表示コンポーネント（PDF/画像自動判定）
 */
export function AttachmentViewer({
  attachment,
  title = "ファイル",
  heightClass = "h-40",
  enableModal = true,
  aspectClass,
}: AttachmentViewerProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { url, isPdf, filename } = getAttachmentInfo(attachment);

  // ファイルがない場合
  if (!url) {
    return (
      <div className={`${aspectClass || heightClass} bg-gray-100 border rounded-lg flex items-center justify-center`}>
        <div className="text-center text-gray-400">
          <FileText className="h-8 w-8 mx-auto mb-1" />
          <p className="text-xs">なし</p>
        </div>
      </div>
    );
  }

  // 画像読み込みエラー
  if (imageError) {
    return (
      <div className={`${aspectClass || heightClass} bg-gray-100 border rounded-lg flex items-center justify-center`}>
        <div className="text-center text-red-400">
          <FileText className="h-8 w-8 mx-auto mb-1" />
          <p className="text-xs">読み込みエラー</p>
        </div>
      </div>
    );
  }

  const handleClick = () => {
    if (enableModal) {
      setShowModal(true);
    }
  };

  return (
    <>
      <div
        className={`${aspectClass || heightClass} bg-gray-100 border rounded-lg overflow-hidden ${enableModal ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
        onClick={handleClick}
      >
        {isPdf ? (
          <iframe
            src={url}
            className="w-full h-full border-0"
            title={title}
          />
        ) : (
          <img
            src={url}
            alt={title}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* 拡大モーダル */}
      {showModal && (
        <AttachmentModal
          url={url}
          isPdf={isPdf}
          title={title}
          filename={filename}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

/**
 * 添付ファイル拡大モーダル
 */
export function AttachmentModal({
  url,
  isPdf,
  title,
  filename,
  onClose,
}: {
  url: string;
  isPdf: boolean;
  title: string;
  filename?: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-900">{title}</span>
            {filename && <span className="text-sm text-gray-500">({filename})</span>}
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={url}
              download
              className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-1" />
              ダウンロード
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 bg-gray-900 overflow-hidden" style={{ height: "80vh" }}>
          {isPdf ? (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={url}
                alt={title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * URLから直接モーダル表示するためのコンポーネント
 */
export function AttachmentModalFromUrl({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  // URLからPDF判定（Content-Typeが取得できないのでURLパターンで判定）
  const isPdf = url.includes(".pdf") || url.includes("application/pdf");

  return (
    <AttachmentModal
      url={url}
      isPdf={isPdf}
      title={title}
      onClose={onClose}
    />
  );
}
