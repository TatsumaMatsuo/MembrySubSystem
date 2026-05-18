import QRCode from "qrcode";

/**
 * QRコード生成サービス
 */

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

const defaultOptions: QRCodeOptions = {
  width: 200,
  margin: 2,
  darkColor: "#000000",
  lightColor: "#ffffff",
};

/**
 * QRコードをBase64 Data URLとして生成
 */
export async function generateQRCodeDataUrl(
  content: string,
  options?: QRCodeOptions
): Promise<string> {
  const opts = { ...defaultOptions, ...options };

  try {
    const dataUrl = await QRCode.toDataURL(content, {
      width: opts.width,
      margin: opts.margin,
      color: {
        dark: opts.darkColor,
        light: opts.lightColor,
      },
    });
    return dataUrl;
  } catch (error) {
    console.error("QRコード生成エラー:", error);
    throw new Error("QRコードの生成に失敗しました");
  }
}

/**
 * QRコードをBufferとして生成（ファイル保存用）
 */
export async function generateQRCodeBuffer(
  content: string,
  options?: QRCodeOptions
): Promise<Buffer> {
  const opts = { ...defaultOptions, ...options };

  try {
    const buffer = await QRCode.toBuffer(content, {
      width: opts.width,
      margin: opts.margin,
      color: {
        dark: opts.darkColor,
        light: opts.lightColor,
      },
    });
    return buffer;
  } catch (error) {
    console.error("QRコード生成エラー:", error);
    throw new Error("QRコードの生成に失敗しました");
  }
}

/**
 * 検証URL用のQRコードを生成
 */
export async function generateVerificationQRCode(
  baseUrl: string,
  verificationToken: string,
  options?: QRCodeOptions
): Promise<string> {
  const verificationUrl = `${baseUrl}/verify/${verificationToken}`;
  return generateQRCodeDataUrl(verificationUrl, options);
}
