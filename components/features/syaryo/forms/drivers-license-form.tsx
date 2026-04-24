"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { driversLicenseSchema, DriversLicenseFormData } from "@/lib/syaryo/validations/application";
import { FileUpload } from "./file-upload";

interface DriversLicenseFormProps {
  onSubmit: (data: DriversLicenseFormData) => Promise<void>;
  isLoading?: boolean;
}

export function DriversLicenseForm({ onSubmit, isLoading = false }: DriversLicenseFormProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUra, setUploadedFileUra] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<DriversLicenseFormData>({
    resolver: zodResolver(driversLicenseSchema),
  });

  const handleFileChange = (file: File | null) => {
    setUploadedFile(file);
    setValue("image_file", file);
  };

  const handleFileChangeUra = (file: File | null) => {
    setUploadedFileUra(file);
    setValue("image_file_ura", file);
  };

  const onFormSubmit = async (data: DriversLicenseFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">免許証情報</h2>

        {/* 免許証画像アップロード（表面・裏面） */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-medium">撮影のポイント：</span>免許証は横向き（横長）で撮影してください。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 表面 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              免許証画像（表面） <span className="text-red-500">*</span>
            </label>
            <FileUpload onFileChange={handleFileChange} />
            {errors.image_file && (
              <p className="mt-1 text-sm text-red-600">{errors.image_file.message}</p>
            )}
          </div>

          {/* 裏面 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              免許証画像（裏面）
            </label>
            <FileUpload onFileChange={handleFileChangeUra} />
            {errors.image_file_ura && (
              <p className="mt-1 text-sm text-red-600">{errors.image_file_ura.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 免許証番号 */}
          <div>
            <label htmlFor="license_number" className="block text-sm font-medium text-gray-700">
              免許証番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="license_number"
              {...register("license_number")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border"
              placeholder="例: 123456789012"
            />
            {errors.license_number && (
              <p className="mt-1 text-sm text-red-600">{errors.license_number.message}</p>
            )}
          </div>

          {/* 免許種類 */}
          <div>
            <label htmlFor="license_type" className="block text-sm font-medium text-gray-700">
              免許種類 <span className="text-red-500">*</span>
            </label>
            <select
              id="license_type"
              {...register("license_type")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border"
            >
              <option value="">選択してください</option>
              <option value="普通">普通</option>
              <option value="準中型">準中型</option>
              <option value="中型">中型</option>
              <option value="大型">大型</option>
              <option value="普通二輪">普通二輪</option>
              <option value="大型二輪">大型二輪</option>
            </select>
            {errors.license_type && (
              <p className="mt-1 text-sm text-red-600">{errors.license_type.message}</p>
            )}
          </div>

          {/* 発行日 */}
          <div>
            <label htmlFor="issue_date" className="block text-sm font-medium text-gray-700">
              発行日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="issue_date"
              {...register("issue_date", {
                setValueAs: (value) => (value ? new Date(value) : undefined),
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border"
            />
            {errors.issue_date && (
              <p className="mt-1 text-sm text-red-600">{errors.issue_date.message}</p>
            )}
          </div>

          {/* 有効期限 */}
          <div>
            <label htmlFor="expiration_date" className="block text-sm font-medium text-gray-700">
              有効期限 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="expiration_date"
              {...register("expiration_date", {
                setValueAs: (value) => (value ? new Date(value) : undefined),
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border"
            />
            {errors.expiration_date && (
              <p className="mt-1 text-sm text-red-600">{errors.expiration_date.message}</p>
            )}
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "送信中..." : "申請する"}
          </button>
        </div>
      </div>
    </form>
  );
}
