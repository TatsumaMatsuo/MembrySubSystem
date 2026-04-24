"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileImage } from "lucide-react";

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  currentFileUrl?: string;
}

export function FileUpload({
  onFileChange,
  accept = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "application/pdf": [".pdf"],
  },
  maxSize = 10485760, // 10MB
  currentFileUrl,
}: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentFileUrl || null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === "file-too-large") {
          setError(`ファイルサイズが大きすぎます（最大${maxSize / 1024 / 1024}MB）`);
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError("サポートされていないファイル形式です");
        } else {
          setError("ファイルのアップロードに失敗しました");
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        onFileChange(file);

        // プレビュー生成
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [onFileChange, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  });

  const clearFile = () => {
    setPreview(null);
    setError(null);
    onFileChange(null);
  };

  return (
    <div className="w-full">
      {!preview ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }
            ${error ? "border-red-500 bg-red-50" : ""}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-blue-600">ファイルをドロップしてください</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                ファイルをドラッグ&ドロップ、またはクリックして選択
              </p>
              <p className="text-sm text-gray-500">
                PNG, JPG, PDF（最大{maxSize / 1024 / 1024}MB）
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative border-2 border-gray-300 rounded-lg p-4">
          <button
            type="button"
            onClick={clearFile}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center space-x-4">
            <FileImage className="h-12 w-12 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">ファイルアップロード完了</p>
              <p className="text-xs text-gray-500">クリックして変更</p>
            </div>
          </div>
          {preview.startsWith("data:image") && (
            <img
              src={preview}
              alt="Preview"
              className="mt-4 max-h-64 rounded-lg object-contain mx-auto"
            />
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
