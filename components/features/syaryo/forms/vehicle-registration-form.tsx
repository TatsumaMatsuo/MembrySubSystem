"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  vehicleRegistrationSchema,
  VehicleRegistrationFormData,
} from "@/lib/syaryo/validations/application";
import { FileUpload } from "./file-upload";

interface VehicleRegistrationFormProps {
  onSubmit: (data: VehicleRegistrationFormData) => Promise<void>;
  isLoading?: boolean;
}

export function VehicleRegistrationForm({
  onSubmit,
  isLoading = false,
}: VehicleRegistrationFormProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<VehicleRegistrationFormData>({
    resolver: zodResolver(vehicleRegistrationSchema),
  });

  const handleFileChange = (file: File | null) => {
    setUploadedFile(file);
    setValue("image_file", file);
  };

  const onFormSubmit = async (data: VehicleRegistrationFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">車検証情報</h2>

        {/* 車検証画像アップロード */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            車検証画像 <span className="text-red-500">*</span>
          </label>
          <FileUpload onFileChange={handleFileChange} />
          {errors.image_file && (
            <p className="mt-1 text-sm text-red-600">{errors.image_file.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 車両番号 */}
          <div>
            <label htmlFor="vehicle_number" className="block text-sm font-medium text-gray-700">
              車両番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vehicle_number"
              {...register("vehicle_number")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
              placeholder="例: 品川 500 あ 12-34"
            />
            {errors.vehicle_number && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicle_number.message}</p>
            )}
          </div>

          {/* 車種 */}
          <div>
            <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700">
              車種 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vehicle_type"
              {...register("vehicle_type")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
              placeholder="例: 普通乗用車"
            />
            {errors.vehicle_type && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicle_type.message}</p>
            )}
          </div>

          {/* メーカー */}
          <div>
            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700">
              メーカー <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="manufacturer"
              {...register("manufacturer")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
              placeholder="例: トヨタ"
            />
            {errors.manufacturer && (
              <p className="mt-1 text-sm text-red-600">{errors.manufacturer.message}</p>
            )}
          </div>

          {/* 車名 */}
          <div>
            <label htmlFor="model_name" className="block text-sm font-medium text-gray-700">
              車名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="model_name"
              {...register("model_name")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
              placeholder="例: プリウス"
            />
            {errors.model_name && (
              <p className="mt-1 text-sm text-red-600">{errors.model_name.message}</p>
            )}
          </div>

          {/* 所有者名 */}
          <div>
            <label htmlFor="owner_name" className="block text-sm font-medium text-gray-700">
              所有者名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="owner_name"
              {...register("owner_name")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
              placeholder="例: 山田 太郎"
            />
            {errors.owner_name && (
              <p className="mt-1 text-sm text-red-600">{errors.owner_name.message}</p>
            )}
          </div>

          {/* 車検有効期限 */}
          <div>
            <label
              htmlFor="inspection_expiration_date"
              className="block text-sm font-medium text-gray-700"
            >
              車検有効期限 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="inspection_expiration_date"
              {...register("inspection_expiration_date", {
                setValueAs: (value) => (value ? new Date(value) : undefined),
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
            />
            {errors.inspection_expiration_date && (
              <p className="mt-1 text-sm text-red-600">
                {errors.inspection_expiration_date.message}
              </p>
            )}
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "送信中..." : "申請する"}
          </button>
        </div>
      </div>
    </form>
  );
}
