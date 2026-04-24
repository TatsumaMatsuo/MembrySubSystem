"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/syaryo/session-shim";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Car,
  Shield,
} from "lucide-react";

interface AnalyticsData {
  applications: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    approvalRate: number;
  };
  byType: {
    licenses: { total: number; approved: number; pending: number; rejected: number };
    vehicles: { total: number; approved: number; pending: number; rejected: number };
    insurance: { total: number; approved: number; pending: number; rejected: number };
  };
  monthlyTrend: {
    month: string;
    approved: number;
    rejected: number;
  }[];
  byDepartment: {
    department: string;
    total: number;
    approved: number;
    pending: number;
  }[];
  expirationAlerts: {
    expiringSoon: number;
    expired: number;
  };
}

const COLORS = {
  approved: "#22c55e",
  pending: "#eab308",
  rejected: "#ef4444",
};

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444"];

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/syaryo/analytics");
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "データの取得に失敗しました");
      }
    } catch (err) {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <p className="text-red-700">{error || "データがありません"}</p>
        </div>
      </div>
    );
  }

  // ステータス別円グラフデータ
  const statusPieData = [
    { name: "承認済み", value: data.applications.approved },
    { name: "審査中", value: data.applications.pending },
    { name: "却下", value: data.applications.rejected },
  ];

  // 書類種別棒グラフデータ
  const typeBarData = [
    {
      name: "免許証",
      承認: data.byType.licenses.approved,
      審査中: data.byType.licenses.pending,
      却下: data.byType.licenses.rejected,
    },
    {
      name: "車検証",
      承認: data.byType.vehicles.approved,
      審査中: data.byType.vehicles.pending,
      却下: data.byType.vehicles.rejected,
    },
    {
      name: "保険証",
      承認: data.byType.insurance.approved,
      審査中: data.byType.insurance.pending,
      却下: data.byType.insurance.rejected,
    },
  ];

  return (
    <div className="p-4 sm:p-8">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-7 w-7" />
          分析ダッシュボード
        </h1>
        <p className="mt-2 text-gray-600">申請状況や承認率などの統計情報</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">総申請件数</p>
              <p className="text-3xl font-bold text-gray-900">{data.applications.total}</p>
            </div>
            <FileText className="h-10 w-10 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">承認率</p>
              <p className="text-3xl font-bold text-green-600">{data.applications.approvalRate}%</p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">審査待ち</p>
              <p className="text-3xl font-bold text-yellow-600">{data.applications.pending}</p>
            </div>
            <Clock className="h-10 w-10 text-yellow-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">期限切れ警告</p>
              <p className="text-3xl font-bold text-red-600">
                {data.expirationAlerts.expiringSoon + data.expirationAlerts.expired}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500 opacity-50" />
          </div>
          <div className="mt-2 text-xs text-gray-500">
            期限切れ: {data.expirationAlerts.expired} / 30日以内: {data.expirationAlerts.expiringSoon}
          </div>
        </div>
      </div>

      {/* グラフセクション */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ステータス別円グラフ */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">ステータス別割合</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">承認済み: {data.applications.approved}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-gray-600">審査中: {data.applications.pending}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-600">却下: {data.applications.rejected}</span>
            </div>
          </div>
        </div>

        {/* 書類種別棒グラフ */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">書類種別ごとの状況</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="承認" fill={COLORS.approved} />
              <Bar dataKey="審査中" fill={COLORS.pending} />
              <Bar dataKey="却下" fill={COLORS.rejected} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月別トレンド */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">月別承認トレンド（過去6ヶ月）</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="approved"
              name="承認"
              stroke={COLORS.approved}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="rejected"
              name="却下"
              stroke={COLORS.rejected}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 部署別状況 */}
      {data.byDepartment.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">部署別申請状況（上位10部署）</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    部署
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    総数
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    承認済み
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    審査中
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    進捗
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.byDepartment.map((dept, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dept.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {dept.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-center">
                      {dept.approved}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 text-center">
                      {dept.pending}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${dept.total > 0 ? (dept.approved / dept.total) * 100 : 0}%`,
                          }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
