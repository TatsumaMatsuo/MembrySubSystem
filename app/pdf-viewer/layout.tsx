import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "PDF ビューア - Membry",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function PdfViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
