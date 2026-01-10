"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// PDF.js worker設定
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface ImageDiffProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeIsPdf?: boolean;
  afterIsPdf?: boolean;
  height?: number;
}

export function ImageDiff({ beforeUrl, afterUrl, beforeIsPdf = false, afterIsPdf = false, height = 400 }: ImageDiffProps) {
  const [diffImageUrl, setDiffImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffPercentage, setDiffPercentage] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!beforeUrl || !afterUrl) {
      setDiffImageUrl(null);
      setError(null);
      return;
    }

    const computeDiff = async () => {
      setLoading(true);
      setError(null);

      try {
        // 画像またはPDFを読み込む
        const [beforeImg, afterImg] = await Promise.all([
          beforeIsPdf ? loadPdfAsImage(beforeUrl) : loadImage(beforeUrl),
          afterIsPdf ? loadPdfAsImage(afterUrl) : loadImage(afterUrl),
        ]);

        // サイズを揃える（大きい方に合わせる）
        const width = Math.max(beforeImg.width, afterImg.width);
        const height = Math.max(beforeImg.height, afterImg.height);

        // Canvas作成
        const beforeCanvas = createCanvas(width, height);
        const afterCanvas = createCanvas(width, height);
        const diffCanvas = createCanvas(width, height);

        const beforeCtx = beforeCanvas.getContext("2d")!;
        const afterCtx = afterCanvas.getContext("2d")!;
        const diffCtx = diffCanvas.getContext("2d")!;

        // 背景を白で塗りつぶし
        beforeCtx.fillStyle = "white";
        beforeCtx.fillRect(0, 0, width, height);
        afterCtx.fillStyle = "white";
        afterCtx.fillRect(0, 0, width, height);

        // 画像を描画（中央揃え）
        const beforeX = Math.floor((width - beforeImg.width) / 2);
        const beforeY = Math.floor((height - beforeImg.height) / 2);
        const afterX = Math.floor((width - afterImg.width) / 2);
        const afterY = Math.floor((height - afterImg.height) / 2);

        beforeCtx.drawImage(beforeImg, beforeX, beforeY);
        afterCtx.drawImage(afterImg, afterX, afterY);

        // ピクセルデータ取得
        const beforeData = beforeCtx.getImageData(0, 0, width, height);
        const afterData = afterCtx.getImageData(0, 0, width, height);
        const diffData = diffCtx.createImageData(width, height);

        // 差分計算（シンプルなピクセル比較）
        let diffCount = 0;
        const threshold = 30; // 差分とみなす閾値

        for (let i = 0; i < beforeData.data.length; i += 4) {
          const rDiff = Math.abs(beforeData.data[i] - afterData.data[i]);
          const gDiff = Math.abs(beforeData.data[i + 1] - afterData.data[i + 1]);
          const bDiff = Math.abs(beforeData.data[i + 2] - afterData.data[i + 2]);

          if (rDiff > threshold || gDiff > threshold || bDiff > threshold) {
            // 差分がある部分を赤くハイライト
            diffData.data[i] = 255;     // R
            diffData.data[i + 1] = 0;   // G
            diffData.data[i + 2] = 0;   // B
            diffData.data[i + 3] = 180; // A（半透明）
            diffCount++;
          } else {
            // 差分がない部分は元画像をグレースケールで表示
            const gray = Math.round(
              (afterData.data[i] + afterData.data[i + 1] + afterData.data[i + 2]) / 3
            );
            diffData.data[i] = gray;
            diffData.data[i + 1] = gray;
            diffData.data[i + 2] = gray;
            diffData.data[i + 3] = 255;
          }
        }

        // 差分率を計算
        const totalPixels = (beforeData.data.length / 4);
        const percentage = (diffCount / totalPixels) * 100;
        setDiffPercentage(Math.round(percentage * 100) / 100);

        // 差分画像を描画
        diffCtx.putImageData(diffData, 0, 0);

        // Data URLに変換
        setDiffImageUrl(diffCanvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Image diff error:", err);
        setError("画像の比較に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    computeDiff();
  }, [beforeUrl, afterUrl]);

  if (!beforeUrl || !afterUrl) {
    return (
      <div
        className="w-full bg-gray-100 rounded flex items-center justify-center text-gray-400"
        style={{ height }}
      >
        <span className="text-sm">両方の画像が必要です</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="w-full bg-gray-100 rounded flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
          <span className="text-sm text-gray-500">差分を計算中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full bg-red-50 rounded flex items-center justify-center text-red-500"
        style={{ height }}
      >
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {diffPercentage !== null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">変更率:</span>
          <span className={`font-bold ${diffPercentage > 10 ? "text-red-600" : diffPercentage > 5 ? "text-orange-500" : "text-green-600"}`}>
            {diffPercentage}%
          </span>
        </div>
      )}
      <div
        className="w-full bg-gray-100 rounded overflow-auto"
        style={{ height }}
      >
        {diffImageUrl && (
          <img
            src={diffImageUrl}
            alt="差分"
            className="w-full h-full object-contain"
          />
        )}
      </div>
      <p className="text-xs text-gray-400 text-center">
        赤色の部分が変更箇所です
      </p>
    </div>
  );
}

// ユーティリティ関数
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = url;
  });
}

// PDFを画像に変換して読み込む
async function loadPdfAsImage(url: string): Promise<HTMLImageElement> {
  try {
    // PDFを読み込む
    const loadingTask = pdfjsLib.getDocument({
      url,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
    });
    const pdf = await loadingTask.promise;

    // 最初のページを取得
    const page = await pdf.getPage(1);

    // 高解像度でレンダリング（スケール2.0）
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    // Canvasを作成
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // PDFをCanvasにレンダリング
    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    // CanvasをImageElementに変換
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("PDF画像変換に失敗しました"));
      img.src = canvas.toDataURL("image/png");
    });
  } catch (error) {
    console.error("PDF loading error:", error);
    throw new Error("PDFの読み込みに失敗しました");
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
