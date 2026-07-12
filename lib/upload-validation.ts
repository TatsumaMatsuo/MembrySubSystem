/**
 * アップロード検証ユーティリティ(多層防御)。
 *
 * 配信側では非PDF/画像を attachment + Content-Type octet-stream 化して保存型XSSを既に遮断済み
 * (app/api/file/proxy, eigyo/sankou-zu/file)。本ユーティリティは入力側の追加防御:
 *  - スクリプト実行に繋がりうる危険な拡張子の拒否(業務文書では通常不要)
 *  - 巨大ペイロードによるメモリ枯渇(DoS)を防ぐサイズ上限
 */

// html/svg/js 等、ブラウザで実行され得る拡張子。業務文書(PDF/画像/Office/CAD等)には不要。
const DANGEROUS_EXT = /\.(x?html?|xht|svg|svgz|js|mjs|cjs|swf|jsp|jspx|php\d?|phtml|phar|htaccess|hta|shtml)$/i;

export function isDangerousUploadName(name: string): boolean {
  return DANGEROUS_EXT.test((name || "").trim());
}

/** 案件書庫等の一般添付(AWS Amplify のリクエストボディ ~6MB 制限に合わせる)。 */
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

/** Excel等の取込・図面PDF。プラットフォーム側でも大サイズは弾かれるが、処理前の上限として。 */
export const MAX_IMPORT_SIZE = 20 * 1024 * 1024;
