// 案件書庫へのファイルアップロード共通ヘルパー(クライアント専用)
//
// - 送信は application/octet-stream(生バイナリ)。Base64膨張(約1.37倍)が無く、AWS Amplify(Lambda)の
//   本文上限 約6MB 内で上限を引き上げられる(サーバ側 MAX_FILE_SIZE=5MB と対応)。
// - 画像は上限超過時のみ高品質で圧縮して救済(劣化を抑えるため高品質から段階的に縮小)。
//   ※画像以外(PDF/Office等)は圧縮せずそのまま送る。

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // サーバの MAX_FILE_SIZE と一致させる

export interface UploadDocumentParams {
  file: Blob;
  fileName: string;
  mimeType?: string;
  seiban: string;
  department?: string;
  documentType: string;
  replace?: boolean;
  targetFileToken?: string | null;
  signal?: AbortSignal;
}

export interface UploadDocumentResult {
  ok: boolean;
  status: number;
  data: any;
}

// 生バイナリ(octet-stream)で /api/documents/upload へ送信。メタデータはクエリで渡す。
export async function uploadDocumentFile(p: UploadDocumentParams): Promise<UploadDocumentResult> {
  const q = new URLSearchParams();
  q.set("fileName", p.fileName);
  q.set("seiban", p.seiban);
  q.set("documentType", p.documentType);
  if (p.department) q.set("department", p.department);
  if (p.mimeType) q.set("mimeType", p.mimeType);
  if (p.replace) q.set("replace", "true");
  if (p.targetFileToken) q.set("targetFileToken", p.targetFileToken);

  const res = await fetch(`/api/documents/upload?${q.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: p.file,
    signal: p.signal,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok && data?.success === true, status: res.status, data };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読込に失敗しました"));
    };
    img.src = url;
  });
}

function drawToJpeg(img: HTMLImageElement, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("canvas未対応"));
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像変換に失敗しました"))), "image/jpeg", quality);
  });
}

// 画像を上限内に収める(必要時のみ)。上限内ならそのまま返し劣化させない。
// 超過時は高品質(長辺3000px/q0.92)から開始し、まず品質→次に寸法を段階的に落として上限内へ。
export async function compressImageToLimit(file: File, maxBytes: number = UPLOAD_MAX_BYTES): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file; // 画像以外は対象外
  if (file.size <= maxBytes) return file; // 収まっていれば無圧縮(劣化させない)
  const img = await loadImage(file);
  let maxDim = 3000;
  let quality = 0.92;
  for (let attempt = 0; attempt < 10; attempt++) {
    const blob = await drawToJpeg(img, maxDim, quality);
    if (blob.size <= maxBytes) return blob;
    if (quality > 0.6) {
      quality = Math.round((quality - 0.08) * 100) / 100;
    } else {
      maxDim = Math.round(maxDim * 0.85);
      quality = 0.85;
    }
  }
  return await drawToJpeg(img, 1400, 0.7); // 最終手段
}

// 画像なら圧縮のうえ、送信用の Blob と拡張子調整済みファイル名を返す。
export async function prepareImageForUpload(file: File, maxBytes: number = UPLOAD_MAX_BYTES): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
  const blob = await compressImageToLimit(file, maxBytes);
  if (blob !== file && blob.type === "image/jpeg") {
    return { blob, fileName: `${file.name.replace(/\.[^.]+$/, "")}.jpg`, mimeType: "image/jpeg" };
  }
  return { blob, fileName: file.name, mimeType: file.type || "application/octet-stream" };
}
