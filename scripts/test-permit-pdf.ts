/**
 * 許可証 PDF 生成テスト
 *  - permit-template.tsx の Font.register が新しいローカルパスで動作するか確認
 *  - 出力は scripts/.tmp/test-permit.pdf
 */
import "@/types/syaryo"; // noop import to anchor tsconfig paths
import path from "path";
import fs from "fs";
import { generatePermitPdfBuffer } from "@/lib/syaryo/services/pdf-generator.service";

async function main() {
  const outDir = path.join(process.cwd(), "scripts", ".tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "test-permit.pdf");

  console.log("[test-permit-pdf] generating...");
  const buf = await generatePermitPdfBuffer({
    employeeName: "テスト 太郎",
    vehicleNumber: "佐賀 500 あ 12-34",
    vehicleModel: "TOYOTA プリウス",
    issueDate: new Date(),
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    permitId: "test-permit-id-1234",
    verificationToken: "test-token-abcd",
    baseUrl: "https://example.test",
  });

  fs.writeFileSync(outPath, buf);
  console.log(`[test-permit-pdf] OK: wrote ${buf.length} bytes to ${outPath}`);
}

main().catch((e) => {
  console.error("[test-permit-pdf] FAILED:", e?.stack || e);
  process.exit(1);
});
