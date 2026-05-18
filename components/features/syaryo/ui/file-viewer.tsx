"use client";

import { useState, useEffect } from "react";
import { FileText, XCircle, Download, ZoomIn, ZoomOut, RotateCw, RotateCcw } from "lucide-react";
import { useFileType, getFileApiUrl } from "@/hooks/syaryo/useFileType";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface FileViewerProps {
  /** ファイルキー（box_xxx, file_xxx, またはローカルファイル名） */
  fileKey: string | null | undefined;
  /** タイトル（オプション） */
  title?: string;
  /** コンパクトモード（サムネイル表示用） */
  compact?: boolean;
  /** 高さのクラス（デフォルト: h-full） */
  heightClass?: string;
  /** 背景色クラス */
  bgClass?: string;
  /** ズーム・回転コントロールを表示するか */
  showControls?: boolean;
  /** クリック時のコールバック */
  onClick?: () => void;
}

/**
 * 動的にファイルタイプを検出して適切なビューアを表示するコンポーネント
 */
export function FileViewer({
  fileKey,
  title = "ファイル",
  compact = false,
  heightClass = "h-full",
  bgClass = "bg-gray-900",
  showControls = true,
  onClick,
}: FileViewerProps) {
  const fileUrl = getFileApiUrl(fileKey);
  const { fileType, loading, error, isPdf, isImage } = useFileType(fileUrl);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // ファイルキーが変わったらリセット
  useEffect(() => {
    setImageRotation(0);
    setImageLoaded(false);
    setImageError(false);
  }, [fileKey]);

  const rotateImage = (degrees: number) => {
    setImageRotation((prev) => (prev + degrees + 360) % 360);
  };

  // ファイルがない場合
  if (!fileKey) {
    return (
      <div className={`${heightClass} ${bgClass} flex items-center justify-center`}>
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">ファイルがアップロードされていません</p>
        </div>
      </div>
    );
  }

  // コンパクトモード（サムネイル表示）
  if (compact) {
    return (
      <div
        className={`${heightClass} ${bgClass} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={onClick}
      >
        {loading ? (
          <div className="animate-pulse bg-gray-300 w-full h-full" />
        ) : isPdf ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
            <FileText className="w-12 h-12 text-red-500" />
            <span className="text-xs text-gray-600 mt-2">PDF</span>
          </div>
        ) : isImage ? (
          <img
            src={fileUrl!}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
            <FileText className="w-12 h-12 text-gray-500" />
            <span className="text-xs text-gray-600 mt-2">ファイル</span>
          </div>
        )}
      </div>
    );
  }

  // 読み込み中
  if (loading) {
    return (
      <div className={`${heightClass} ${bgClass} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">ファイルタイプを検出中...</p>
        </div>
      </div>
    );
  }

  // エラー
  if (error || imageError) {
    return (
      <div className={`${heightClass} ${bgClass} flex items-center justify-center`}>
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-400">ファイルの読み込みに失敗しました</p>
        </div>
      </div>
    );
  }

  // PDF表示
  if (isPdf) {
    return (
      <div className={`${heightClass} flex flex-col ${bgClass}`}>
        {/* コントロールバー */}
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <h3 className="text-white font-medium">{title}</h3>
          <a
            href={fileUrl!}
            download
            className="flex items-center px-3 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-white text-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            ダウンロード
          </a>
        </div>
        {/* PDF */}
        <div className="flex-1">
          <iframe
            src={fileUrl!}
            className="w-full h-full border-0"
            title={title}
          />
        </div>
      </div>
    );
  }

  // 画像表示
  if (isImage) {
    return (
      <div className={`${heightClass} flex flex-col ${bgClass}`}>
        {/* コントロールバー */}
        {showControls && (
          <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-medium">{title}</h3>
            {/* 回転コントロール */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => rotateImage(-90)}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                title="左に90°回転"
              >
                <RotateCcw className="h-4 w-4 text-white" />
              </button>
              <span className="text-white text-sm min-w-[40px] text-center">
                {imageRotation}°
              </span>
              <button
                onClick={() => rotateImage(90)}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                title="右に90°回転"
              >
                <RotateCw className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* 画像表示エリア */}
        <div className="flex-1 relative">
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            key={`${fileKey}-${imageRotation}`}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* ズームコントロール */}
                {showControls && (
                  <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
                    <button
                      onClick={() => zoomIn()}
                      className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                      title="拡大"
                    >
                      <ZoomIn className="h-5 w-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                      title="縮小"
                    >
                      <ZoomOut className="h-5 w-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => {
                        resetTransform();
                        setImageRotation(0);
                      }}
                      className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                      title="リセット"
                    >
                      <RotateCw className="h-5 w-5 text-gray-700" />
                    </button>
                    <a
                      href={fileUrl!}
                      download
                      className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                      title="ダウンロード"
                    >
                      <Download className="h-5 w-5 text-gray-700" />
                    </a>
                  </div>
                )}

                <TransformComponent
                  wrapperClass="w-full h-full"
                  contentClass="w-full h-full flex items-center justify-center"
                >
                  <img
                    src={fileUrl!}
                    alt={title}
                    className="max-w-full max-h-full object-contain transition-transform duration-300"
                    style={{ transform: `rotate(${imageRotation}deg)` }}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      </div>
    );
  }

  // 不明なファイルタイプ
  return (
    <div className={`${heightClass} ${bgClass} flex items-center justify-center`}>
      <div className="text-center">
        <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">このファイル形式は表示できません</p>
        <a
          href={fileUrl!}
          download
          className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4 mr-2" />
          ダウンロード
        </a>
      </div>
    </div>
  );
}

/**
 * シンプルなファイルプレビュー（iframe/img自動切り替え）
 */
export function SimpleFilePreview({
  fileKey,
  title = "ファイル",
  className = "",
}: {
  fileKey: string | null | undefined;
  title?: string;
  className?: string;
}) {
  const fileUrl = getFileApiUrl(fileKey);
  const { isPdf, isImage, loading, error } = useFileType(fileUrl);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // fileKeyが変わったらリセット
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [fileKey]);

  if (!fileKey || !fileUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="animate-pulse bg-gray-300 w-full h-full" />
      </div>
    );
  }

  if (error || imgError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <XCircle className="h-8 w-8 text-red-400 mb-2" />
        <p className="text-sm text-red-500">画像の読み込みに失敗しました</p>
        <p className="text-xs text-gray-400 mt-1">Token: {fileKey?.substring(0, 20)}...</p>
      </div>
    );
  }

  if (isPdf) {
    return (
      <iframe
        src={fileUrl}
        className={`w-full ${className}`}
        title={title}
      />
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      <img
        src={fileUrl}
        alt={title}
        className={`object-contain w-full h-full ${imgLoaded ? '' : 'opacity-0'}`}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
