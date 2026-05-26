const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const { createCanvas } = require("canvas");
const fs = require("fs");

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    process.stderr.write("Usage: node pdf-to-image.cjs <pdf-path>\n");
    process.exit(1);
  }

  const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data: pdfData, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 5 });

  const fullCanvas = createCanvas(viewport.width, viewport.height);
  const fullCtx = fullCanvas.getContext("2d");
  await page.render({ canvasContext: fullCtx, viewport }).promise;

  const cropW = Math.round(viewport.width * 0.32);
  const cropY = Math.round(viewport.height * 0.28);
  const cropH = viewport.height - cropY - Math.round(viewport.height * 0.12);

  const cropCanvas = createCanvas(cropW, cropH);
  const cropCtx = cropCanvas.getContext("2d");
  cropCtx.drawImage(fullCanvas, 0, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const buf = cropCanvas.toBuffer("image/png");
  const base64 = buf.toString("base64");
  process.stdout.write(base64);
}

main().catch((err) => {
  process.stderr.write(err.message + "\n");
  process.exit(1);
});
