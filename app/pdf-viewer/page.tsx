"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { Download, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

function PdfViewerContent() {
  const searchParams = useSearchParams();
  const fileToken = searchParams.get("file_token") || "";
  const fileName = searchParams.get("name") || "file.pdf";
  const source = searchParams.get("source") || "";

  const proxyUrl = `/api/file/proxy?file_token=${encodeURIComponent(fileToken)}&name=${encodeURIComponent(fileName)}${source ? `&source=${source}` : ""}`;
  const downloadUrl = `${proxyUrl}&disposition=attachment`;

  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCanvases, setPageCanvases] = useState<Map<number, string>>(new Map());
  const renderingRef = useRef<Set<number>>(new Set());

  // PDF読み込み
  useEffect(() => {
    if (!fileToken) return;
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument({
          url: proxyUrl,
          cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        if (!cancelled) {
          setError("PDFの読み込みに失敗しました");
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => { cancelled = true; };
  }, [fileToken, proxyUrl]);

  // ページレンダリング
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || renderingRef.current.has(pageNum)) return;
    renderingRef.current.add(pageNum);

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 }); // 高解像度レンダリング

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;

      await page.render({ canvasContext: context, viewport }).promise;

      const dataUrl = canvas.toDataURL("image/png");
      setPageCanvases(prev => new Map(prev).set(pageNum, dataUrl));
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
    } finally {
      renderingRef.current.delete(pageNum);
    }
  }, [pdfDoc]);

  // 全ページをレンダリング
  useEffect(() => {
    if (!pdfDoc) return;
    for (let i = 1; i <= totalPages; i++) {
      renderPage(i);
    }
  }, [pdfDoc, totalPages, renderPage]);

  // ズーム操作
  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

  // スクロールでページ番号を更新
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || totalPages === 0) return;

    const images = container.querySelectorAll("[data-page]");
    let closestPage = 1;
    let closestDistance = Infinity;

    images.forEach((img) => {
      const rect = img.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const distance = Math.abs(rect.top - containerRect.top);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = parseInt(img.getAttribute("data-page") || "1");
      }
    });

    setCurrentPage(closestPage);
  }, [totalPages]);

  // ページジャンプ
  const goToPage = (page: number) => {
    const el = containerRef.current?.querySelector(`[data-page="${page}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!fileToken) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 text-lg">ファイルトークンが指定されていません</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-900 touch-manipulation">
      {/* ヘッダー */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 gap-2">
        <h1 className="text-xs sm:text-sm font-medium text-gray-200 truncate min-w-0 flex-1">
          {fileName}
        </h1>
        <a
          href={downloadUrl}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">ダウンロード</span>
        </a>
      </div>

      {/* ツールバー */}
      {!loading && !error && totalPages > 0 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
          <button
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs sm:text-sm text-gray-300 min-w-[80px] text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-gray-600 mx-1" />
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs text-gray-400 min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* PDF表示エリア */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-gray-400 text-sm">PDFを読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
            <a
              href={downloadUrl}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              ダウンロードして表示
            </a>
          </div>
        )}

        {!loading && !error && totalPages > 0 && (
          <div className="flex flex-col items-center gap-2 py-4 px-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                className="bg-white shadow-lg"
                style={{
                  width: `${scale * 100}%`,
                  maxWidth: `${scale * 100}%`,
                }}
              >
                {pageCanvases.has(pageNum) ? (
                  <img
                    src={pageCanvases.get(pageNum)}
                    alt={`Page ${pageNum}`}
                    className="w-full h-auto block"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full aspect-[210/297] flex items-center justify-center bg-gray-100">
                    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PdfViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-gray-900">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        </div>
      }
    >
      <PdfViewerContent />
    </Suspense>
  );
}
