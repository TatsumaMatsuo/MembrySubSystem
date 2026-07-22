/**
 * 棚卸: Code 39 バーコード読取ラッパ
 *
 * 現品ラベルは1次元 Code 39（Phase 0 実物確認）。誤り訂正が無く読取が難しいため、
 * フォーマットを Code 39 に限定し、読取結果は normalizeItemCode() で厳格に検証する。
 *
 * BarcodeDetector（Android Chrome で高速）が使えれば優先し、無ければ @zxing/browser。
 */
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
export { normalizeItemCode } from "./item-code";

export interface ScannerHandle {
  stop: () => void;
}

type OnDetect = (rawText: string) => void;

/** BarcodeDetector が Code 39 を扱えるか */
async function detectorSupportsCode39(): Promise<boolean> {
  const BD = (globalThis as any).BarcodeDetector;
  if (!BD) return false;
  try {
    const formats: string[] = await BD.getSupportedFormats();
    return formats.includes("code_39");
  } catch {
    return false;
  }
}

/**
 * カメラを起動して連続読取を開始する。
 * @param video 対象の <video> 要素
 * @param onDetect 読取のたびに raw テキストを渡す（正規化は呼び出し側で normalizeItemCode）
 * @returns stop() で停止
 */
export async function startScanner(video: HTMLVideoElement, onDetect: OnDetect): Promise<ScannerHandle> {
  // 背面カメラ・高解像度（1次元は解像度が効く）
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  await video.play().catch(() => {});

  let stopped = false;

  // --- 経路A: BarcodeDetector（対応時） ---
  if (await detectorSupportsCode39()) {
    const BD = (globalThis as any).BarcodeDetector;
    const detector = new BD({ formats: ["code_39"] });
    const loop = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length) onDetect(String(codes[0].rawValue || ""));
      } catch {
        /* フレーム取得失敗は無視して継続 */
      }
      if (!stopped) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return {
      stop: () => {
        stopped = true;
        stream.getTracks().forEach((t) => t.stop());
      },
    };
  }

  // --- 経路B: @zxing/browser（Code 39 限定） ---
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

  const controls = await reader.decodeFromVideoElement(video, (result) => {
    if (stopped) return;
    if (result) onDetect(result.getText());
  });

  return {
    stop: () => {
      stopped = true;
      try {
        controls.stop();
      } catch {
        /* noop */
      }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
