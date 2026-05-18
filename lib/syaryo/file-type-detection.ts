/**
 * ファイルタイプ検出ユーティリティ
 * マジックバイト（ファイル署名）からMIMEタイプを判定
 */

interface FileSignature {
  bytes: number[];
  offset?: number;
  mimeType: string;
  extension: string;
}

// ファイル署名の定義
const FILE_SIGNATURES: FileSignature[] = [
  // JPEG
  { bytes: [0xFF, 0xD8, 0xFF], mimeType: "image/jpeg", extension: "jpg" },
  // PNG
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: "image/png", extension: "png" },
  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], mimeType: "application/pdf", extension: "pdf" },
  // GIF87a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mimeType: "image/gif", extension: "gif" },
  // GIF89a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mimeType: "image/gif", extension: "gif" },
  // WebP
  { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: "image/webp", extension: "webp" },
  // BMP
  { bytes: [0x42, 0x4D], mimeType: "image/bmp", extension: "bmp" },
  // TIFF (little-endian)
  { bytes: [0x49, 0x49, 0x2A, 0x00], mimeType: "image/tiff", extension: "tiff" },
  // TIFF (big-endian)
  { bytes: [0x4D, 0x4D, 0x00, 0x2A], mimeType: "image/tiff", extension: "tiff" },
];

export interface DetectedFileType {
  mimeType: string;
  extension: string;
}

/**
 * バッファからファイルタイプを検出
 */
export function detectFileType(buffer: Buffer | Uint8Array): DetectedFileType {
  const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

  for (const signature of FILE_SIGNATURES) {
    const offset = signature.offset || 0;
    let matches = true;

    for (let i = 0; i < signature.bytes.length; i++) {
      if (bytes[offset + i] !== signature.bytes[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // WebPの追加チェック（RIFFヘッダーの後にWEBPが必要）
      if (signature.mimeType === "image/webp") {
        if (bytes.length >= 12 &&
            bytes[8] === 0x57 && // W
            bytes[9] === 0x45 && // E
            bytes[10] === 0x42 && // B
            bytes[11] === 0x50) { // P
          return { mimeType: signature.mimeType, extension: signature.extension };
        }
        continue; // WebPではない場合はスキップ
      }

      return { mimeType: signature.mimeType, extension: signature.extension };
    }
  }

  // 検出できない場合はデフォルト
  return { mimeType: "application/octet-stream", extension: "bin" };
}

/**
 * MIMEタイプが画像かどうかを判定
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * MIMEタイプがPDFかどうかを判定
 */
export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * サポートされているファイルタイプかどうかを判定
 */
export function isSupportedFileType(mimeType: string): boolean {
  const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/pdf",
  ];
  return supportedTypes.includes(mimeType);
}
