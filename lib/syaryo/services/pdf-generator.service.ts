import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PermitTemplate, PermitTemplateProps, CompanyInfo } from "@/components/features/syaryo/pdf/permit-template";
import { generateVerificationQRCode } from "./qrcode.service";
import { getCompanyInfo } from "./system-settings.service";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// uploadsディレクトリが存在しない場合は作成
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface GeneratePermitPdfInput {
  employeeName: string;
  vehicleNumber: string;
  vehicleModel: string;
  issueDate: Date;
  expirationDate: Date;
  permitId: string;
  verificationToken: string;
  baseUrl: string;
}

/**
 * 日付を確実に有効なDateオブジェクトに変換
 */
function ensureValidDate(dateValue: Date | string | number | undefined | null, fallback: Date): Date {
  if (!dateValue) return fallback;
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * 許可証PDFを生成してファイルに保存
 * @returns 保存されたファイルのキー（file_key）
 */
export async function generatePermitPdf(
  input: GeneratePermitPdfInput
): Promise<string> {
  try {
    // 日付を検証（Invalid Date対策）
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const validIssueDate = ensureValidDate(input.issueDate, now);
    const validExpirationDate = ensureValidDate(input.expirationDate, oneYearLater);

    // QRコードを生成（verificationTokenが空の場合はpermitIdを使用）
    const verificationToken = input.verificationToken || input.permitId;
    const qrCodeDataUrl = await generateVerificationQRCode(
      input.baseUrl,
      verificationToken
    );

    // 会社情報を取得
    const companyInfo: CompanyInfo = await getCompanyInfo();

    // PDFテンプレートのprops（検証済みの日付を使用）
    const templateProps: PermitTemplateProps = {
      employeeName: input.employeeName,
      vehicleNumber: input.vehicleNumber,
      vehicleModel: input.vehicleModel,
      issueDate: validIssueDate,
      expirationDate: validExpirationDate,
      qrCodeDataUrl,
      permitId: input.permitId,
      companyInfo,
    };

    // PDFをバッファとして生成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(PermitTemplate, templateProps) as any
    );

    // ファイルキーを生成
    const fileKey = `permit_${Date.now()}_${crypto.randomBytes(8).toString("hex")}.pdf`;
    const filePath = path.join(UPLOAD_DIR, fileKey);

    // ファイルに保存
    fs.writeFileSync(filePath, pdfBuffer);

    console.log(`許可証PDFを生成しました: ${fileKey}`);
    return fileKey;
  } catch (error) {
    console.error("許可証PDF生成エラー:", error);
    throw new Error("許可証PDFの生成に失敗しました");
  }
}

/**
 * 許可証PDFをバッファとして生成（プレビュー用）
 */
export async function generatePermitPdfBuffer(
  input: GeneratePermitPdfInput
): Promise<Buffer> {
  try {
    // 日付を検証（Invalid Date対策）
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const validIssueDate = ensureValidDate(input.issueDate, now);
    const validExpirationDate = ensureValidDate(input.expirationDate, oneYearLater);

    // QRコードを生成（verificationTokenが空の場合はpermitIdを使用）
    const verificationToken = input.verificationToken || input.permitId;
    const qrCodeDataUrl = await generateVerificationQRCode(
      input.baseUrl,
      verificationToken
    );

    // 会社情報を取得
    const companyInfo: CompanyInfo = await getCompanyInfo();

    // PDFテンプレートのprops（検証済みの日付を使用）
    const templateProps: PermitTemplateProps = {
      employeeName: input.employeeName,
      vehicleNumber: input.vehicleNumber,
      vehicleModel: input.vehicleModel,
      issueDate: validIssueDate,
      expirationDate: validExpirationDate,
      qrCodeDataUrl,
      permitId: input.permitId,
      companyInfo,
    };

    // PDFをバッファとして生成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(PermitTemplate, templateProps) as any
    );

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error("許可証PDF生成エラー:", error);
    throw new Error("許可証PDFの生成に失敗しました");
  }
}

/**
 * 保存されたPDFファイルを取得
 */
export function getPermitPdfPath(fileKey: string): string | null {
  // fileKeyが空の場合はnullを返す
  if (!fileKey || fileKey.trim() === "") {
    return null;
  }
  const filePath = path.join(UPLOAD_DIR, fileKey);
  // ファイルが存在し、かつディレクトリでないことを確認
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath;
  }
  return null;
}

/**
 * 保存されたPDFファイルをバッファとして読み込む
 */
export function readPermitPdf(fileKey: string): Buffer | null {
  const filePath = getPermitPdfPath(fileKey);
  if (filePath) {
    return fs.readFileSync(filePath);
  }
  return null;
}
