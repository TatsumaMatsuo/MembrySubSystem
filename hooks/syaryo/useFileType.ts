"use client";

import { useState, useEffect, useCallback } from "react";

export type FileType = "pdf" | "image" | "unknown" | null;

interface UseFileTypeResult {
  fileType: FileType;
  loading: boolean;
  error: boolean;
  isPdf: boolean;
  isImage: boolean;
  refetch: () => void;
}

/**
 * ファイルのContent-Typeを動的に検出するフック
 * @param fileUrl - ファイルのURL（/api/files/xxx形式）
 * @returns ファイルタイプ情報
 */
export function useFileType(fileUrl: string | null | undefined): UseFileTypeResult {
  const [fileType, setFileType] = useState<FileType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const detectFileType = useCallback(async () => {
    if (!fileUrl) {
      setFileType(null);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      // HEADリクエストでContent-Typeを取得
      const response = await fetch(fileUrl, { method: "HEAD" });

      if (!response.ok) {
        setError(true);
        setFileType("unknown");
        return;
      }

      const contentType = response.headers.get("Content-Type") || "";

      if (contentType.includes("application/pdf")) {
        setFileType("pdf");
      } else if (contentType.includes("image/")) {
        setFileType("image");
      } else {
        setFileType("unknown");
      }
    } catch (err) {
      console.error("Failed to detect file type:", err);
      setError(true);
      setFileType("unknown");
    } finally {
      setLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    detectFileType();
  }, [detectFileType]);

  return {
    fileType,
    loading,
    error,
    isPdf: fileType === "pdf",
    isImage: fileType === "image",
    refetch: detectFileType,
  };
}

/**
 * ファイルキーからAPIのURLを生成
 * @param fileKey - ファイルトークン（Lark Drive添付ファイル）
 * @param downloadUrl - オプションのLark直接ダウンロードURL
 * @returns API URL
 */
export function getFileApiUrl(fileKey: string | null | undefined, downloadUrl?: string): string | null {
  if (!fileKey) return null;
  // 新しいLark Base添付ファイル形式を使用
  const baseUrl = `/api/attachments/${fileKey}`;
  if (downloadUrl) {
    return `${baseUrl}?url=${encodeURIComponent(downloadUrl)}`;
  }
  return baseUrl;
}
