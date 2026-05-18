"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insurancePolicySchema,
  InsurancePolicyFormData,
  INSURANCE_REQUIREMENTS,
} from "@/lib/syaryo/validations/application";
import { FileUpload } from "./file-upload";
import { AlertTriangle } from "lucide-react";

interface InsurancePolicyFormProps {
  onSubmit: (data: InsurancePolicyFormData) => Promise<void>;
  isLoading?: boolean;
}

export function InsurancePolicyForm({ onSubmit, isLoading = false }: InsurancePolicyFormProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InsurancePolicyFormData>({
    resolver: zodResolver(insurancePolicySchema),
    defaultValues: {
      liability_personal_unlimited: false,
    },
  });

  const liabilityPersonalUnlimited = watch("liability_personal_unlimited");

  const handleFileChange = (file: File | null) => {
    setUploadedFile(file);
    setValue("image_file", file);
  };

  const onFormSubmit = async (data: InsurancePolicyFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">任意保険証情報</h2>

        {/* 会社規定の説明 */}
        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                会社規定による任意保険の契約条件
              </h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>マイカー通勤許可証の発行には、以下の条件を満たす必要があります：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>対人補償</strong>: 無制限のみ</li>
                  <li><strong>対物補償</strong>: {INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN.toLocaleString()}万円以上</li>
                  <li><strong>搭乗者傷害</strong>: {INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN.toLocaleString()}万円以上</li>
                </ul>
                <p className="mt-2 text-amber-800 font-medium">
                  ※ 上記条件を満たさない場合、許可証を発行できません。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 任意保険証画像アップロード */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            任意保険証画像 <span className="text-red-500">*</span>
          </label>
          <FileUpload onFileChange={handleFileChange} />
          {errors.image_file && (
            <p className="mt-1 text-sm text-red-600">{errors.image_file.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 保険証券番号 */}
          <div>
            <label htmlFor="policy_number" className="block text-sm font-medium text-gray-700">
              保険証券番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="policy_number"
              {...register("policy_number")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
              placeholder="例: ABC-123456789"
            />
            {errors.policy_number && (
              <p className="mt-1 text-sm text-red-600">{errors.policy_number.message}</p>
            )}
          </div>

          {/* 保険会社名 */}
          <div>
            <label
              htmlFor="insurance_company"
              className="block text-sm font-medium text-gray-700"
            >
              保険会社名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="insurance_company"
              {...register("insurance_company")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
              placeholder="例: 東京海上日動火災保険"
            />
            {errors.insurance_company && (
              <p className="mt-1 text-sm text-red-600">{errors.insurance_company.message}</p>
            )}
          </div>

          {/* 保険種類 */}
          <div>
            <label htmlFor="policy_type" className="block text-sm font-medium text-gray-700">
              保険種類 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="policy_type"
              {...register("policy_type")}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
              placeholder="例: 自動車保険"
            />
            {errors.policy_type && (
              <p className="mt-1 text-sm text-red-600">{errors.policy_type.message}</p>
            )}
          </div>

          {/* 補償開始日 */}
          <div>
            <label
              htmlFor="coverage_start_date"
              className="block text-sm font-medium text-gray-700"
            >
              補償開始日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="coverage_start_date"
              {...register("coverage_start_date", {
                setValueAs: (value) => (value ? new Date(value) : undefined),
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
            />
            {errors.coverage_start_date && (
              <p className="mt-1 text-sm text-red-600">{errors.coverage_start_date.message}</p>
            )}
          </div>

          {/* 補償終了日 */}
          <div>
            <label htmlFor="coverage_end_date" className="block text-sm font-medium text-gray-700">
              補償終了日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="coverage_end_date"
              {...register("coverage_end_date", {
                setValueAs: (value) => (value ? new Date(value) : undefined),
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
            />
            {errors.coverage_end_date && (
              <p className="mt-1 text-sm text-red-600">{errors.coverage_end_date.message}</p>
            )}
          </div>
        </div>

        {/* 補償内容セクション */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">補償内容</h3>

          {/* 対人補償（無制限チェック） */}
          <div className="mb-6">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="liability_personal_unlimited"
                  {...register("liability_personal_unlimited")}
                  className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3">
                <label
                  htmlFor="liability_personal_unlimited"
                  className="text-sm font-medium text-gray-700"
                >
                  対人補償が無制限である <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-500">
                  対人補償は無制限の契約のみ許可されます
                </p>
              </div>
            </div>
            {errors.liability_personal_unlimited && (
              <p className="mt-1 text-sm text-red-600">{errors.liability_personal_unlimited.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 対物補償金額 */}
            <div>
              <label
                htmlFor="liability_property_amount"
                className="block text-sm font-medium text-gray-700"
              >
                対物補償金額 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-center">
                <input
                  type="number"
                  id="liability_property_amount"
                  {...register("liability_property_amount", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
                  placeholder={`${INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN}以上`}
                  min={0}
                />
                <span className="ml-2 text-sm text-gray-500 whitespace-nowrap">万円</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                ※ {INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN.toLocaleString()}万円以上が必要です
              </p>
              {errors.liability_property_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.liability_property_amount.message}</p>
              )}
            </div>

            {/* 搭乗者傷害金額 */}
            <div>
              <label
                htmlFor="passenger_injury_amount"
                className="block text-sm font-medium text-gray-700"
              >
                搭乗者傷害金額 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-center">
                <input
                  type="number"
                  id="passenger_injury_amount"
                  {...register("passenger_injury_amount", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm px-4 py-2 border"
                  placeholder={`${INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN}以上`}
                  min={0}
                />
                <span className="ml-2 text-sm text-gray-500 whitespace-nowrap">万円</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                ※ {INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN.toLocaleString()}万円以上が必要です
              </p>
              {errors.passenger_injury_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.passenger_injury_amount.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* 送信ボタン */}
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "送信中..." : "申請する"}
          </button>
        </div>
      </div>
    </form>
  );
}
