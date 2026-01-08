"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, FileText } from "lucide-react";

interface PdfThumbnailProps {
  url: string;
  className?: string;
}

export default function PdfThumbnail({ url, className = "" }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderPdf = async () => {
      if (!url || !canvasRef.current) return;

      try {
        setLoading(true);
        setError(false);

        // Dynamic import of PDF.js to avoid SSR issues
        const pdfjsLib = await import("pdfjs-dist");

        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;

        if (cancelled) return;

        // Get the first page
        const page = await pdf.getPage(1);

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        // Calculate scale to fit the thumbnail size
        const desiredWidth = 400;
        const viewport = page.getViewport({ scale: 1 });
        const scale = desiredWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        // Render the page
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (cancelled) return;

        setLoading(false);
      } catch (err) {
        console.error("Error rendering PDF thumbnail:", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 ${className}`}>
        <FileText className="w-10 h-10 text-red-400" />
        <span className="text-xs text-gray-500 mt-1">PDF</span>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center bg-gray-100 overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`max-w-full max-h-full object-contain ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}
      />
    </div>
  );
}
