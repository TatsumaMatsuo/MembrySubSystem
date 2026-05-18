"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Car, User, Calendar } from "lucide-react";

interface VerificationResult {
  valid: boolean;
  permit?: {
    employee_name: string;
    vehicle_number: string;
    vehicle_model: string;
    issue_date: string;
    expiration_date: string;
    status: string;
  };
  message: string;
}

export default function VerifyPermitPage() {
  const params = useParams();
  const token = params.token as string;
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyPermit() {
      if (!token) {
        setError("検証トークンがありません");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/syaryo/verify/${token}`);
        const data = await response.json();
        setResult(data);
      } catch (err) {
        setError("検証中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    }

    verifyPermit();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">許可証を検証中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">検証エラー</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {/* ステータスアイコン */}
        <div className="text-center mb-6">
          {result?.valid ? (
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {result?.valid ? "有効な許可証" : "無効な許可証"}
          </h1>
          <p className={`text-lg ${result?.valid ? "text-green-600" : "text-red-600"}`}>
            {result?.message}
          </p>
        </div>

        {/* 許可証詳細 */}
        {result?.permit && (
          <div className="border-t pt-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              許可証情報
            </h2>

            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">社員名</p>
                <p className="text-gray-900 font-medium">
                  {result.permit.employee_name}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Car className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">車両番号</p>
                <p className="text-gray-900 font-medium">
                  {result.permit.vehicle_number}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {result.permit.vehicle_model}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">有効期限</p>
                <p className={`font-medium ${result.valid ? "text-gray-900" : "text-red-600"}`}>
                  {result.permit.expiration_date}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">発行日</p>
                <p className="text-gray-900">
                  {result.permit.issue_date}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="border-t mt-6 pt-6 text-center">
          <p className="text-sm text-gray-500">
            車両関連管理システム
          </p>
        </div>
      </div>
    </div>
  );
}
