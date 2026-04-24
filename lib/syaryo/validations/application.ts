import { z } from "zod";

// 免許証申請フォームのバリデーションスキーマ
export const driversLicenseSchema = z.object({
  license_number: z
    .string()
    .min(1, "免許証番号を入力してください")
    .max(50, "免許証番号は50文字以内で入力してください"),
  license_type: z
    .string()
    .min(1, "免許種類を選択してください"),
  issue_date: z
    .date({
      message: "発行日を選択してください",
    }),
  expiration_date: z
    .date({
      message: "有効期限を選択してください",
    }),
  image_file: z
    .instanceof(File, { message: "免許証（表面）の画像をアップロードしてください" })
    .optional()
    .nullable(),
  image_file_ura: z
    .instanceof(File, { message: "免許証（裏面）の画像をアップロードしてください" })
    .optional()
    .nullable(),
});

export type DriversLicenseFormData = z.infer<typeof driversLicenseSchema>;

// 車検証申請フォームのバリデーションスキーマ
export const vehicleRegistrationSchema = z.object({
  vehicle_number: z
    .string()
    .min(1, "車両番号を入力してください")
    .max(20, "車両番号は20文字以内で入力してください"),
  vehicle_type: z
    .string()
    .min(1, "車種を入力してください"),
  manufacturer: z
    .string()
    .min(1, "メーカーを入力してください"),
  model_name: z
    .string()
    .min(1, "車名を入力してください"),
  inspection_expiration_date: z
    .date({
      message: "車検有効期限を選択してください",
    }),
  owner_name: z
    .string()
    .min(1, "所有者名を入力してください"),
  image_file: z
    .instanceof(File, { message: "車検証の画像をアップロードしてください" })
    .optional()
    .nullable(),
});

export type VehicleRegistrationFormData = z.infer<typeof vehicleRegistrationSchema>;

/**
 * 会社規定による任意保険の契約条件:
 * - 対人補償: 無制限のみ
 * - 対物補償: 5000万円以上
 * - 搭乗者傷害: 2000万円以上
 *
 * これらの条件を満たさない場合、許可証を発行できません。
 */
export const INSURANCE_REQUIREMENTS = {
  LIABILITY_PROPERTY_MIN: 5000, // 対物補償最低金額（万円）
  PASSENGER_INJURY_MIN: 2000, // 搭乗者傷害最低金額（万円）
} as const;

// 任意保険証申請フォームのバリデーションスキーマ
export const insurancePolicySchema = z.object({
  policy_number: z
    .string()
    .min(1, "保険証券番号を入力してください")
    .max(50, "保険証券番号は50文字以内で入力してください"),
  insurance_company: z
    .string()
    .min(1, "保険会社名を入力してください"),
  policy_type: z
    .string()
    .min(1, "保険種類を入力してください"),
  coverage_start_date: z
    .date({
      message: "補償開始日を選択してください",
    }),
  coverage_end_date: z
    .date({
      message: "補償終了日を選択してください",
    }),
  // 対人補償無制限チェック（必須）
  liability_personal_unlimited: z
    .boolean()
    .refine((val) => val === true, {
      message: "対人補償は無制限である必要があります（チェックを入れてください）",
    }),
  // 対物補償金額（万円単位、5000万以上必須）
  liability_property_amount: z
    .number({
      message: "対物補償金額を数値で入力してください",
    })
    .min(INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN,
      `対物補償は${INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN}万円以上が必要です`),
  // 搭乗者傷害金額（万円単位、2000万以上必須）
  passenger_injury_amount: z
    .number({
      message: "搭乗者傷害金額を数値で入力してください",
    })
    .min(INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN,
      `搭乗者傷害は${INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN}万円以上が必要です`),
  insured_amount: z
    .number({
      message: "補償金額は数値で入力してください",
    })
    .optional()
    .nullable(),
  image_file: z
    .instanceof(File, { message: "任意保険証の画像をアップロードしてください" })
    .optional()
    .nullable(),
});

export type InsurancePolicyFormData = z.infer<typeof insurancePolicySchema>;

/**
 * 保険契約が会社規定を満たしているかチェック
 */
export function checkInsuranceRequirements(insurance: {
  liability_personal_unlimited: boolean;
  liability_property_amount: number;
  passenger_injury_amount: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!insurance.liability_personal_unlimited) {
    errors.push("対人補償が無制限ではありません");
  }

  if (insurance.liability_property_amount < INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN) {
    errors.push(`対物補償が${INSURANCE_REQUIREMENTS.LIABILITY_PROPERTY_MIN}万円未満です`);
  }

  if (insurance.passenger_injury_amount < INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN) {
    errors.push(`搭乗者傷害が${INSURANCE_REQUIREMENTS.PASSENGER_INJURY_MIN}万円未満です`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
