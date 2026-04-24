"use client";

import { useState, useEffect, useCallback } from "react";
import { Employee } from "@/types/syaryo";
import { Users, UserX, UserCheck, Calendar, Briefcase } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeResigned, setIncludeResigned] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [showRetireModal, setShowRetireModal] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/syaryo/employees?includeResigned=${includeResigned}`
      );
      const data = await response.json();

      if (data.success) {
        setEmployees(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  }, [includeResigned]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleRetire = async (
    employee: Employee,
    resignationDate: Date
  ) => {
    try {
      const response = await fetch(
        `/api/syaryo/employees/${employee.employee_id}/retire`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resignationDate: resignationDate.toISOString(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(
          `${employee.employee_name}さんを退職処理しました。\n` +
            `削除された書類:\n` +
            `- 免許証: ${data.data.documents.licensesDeleted}件\n` +
            `- 車検証: ${data.data.documents.vehiclesDeleted}件\n` +
            `- 任意保険: ${data.data.documents.insurancesDeleted}件`
        );
        fetchEmployees();
      } else {
        throw new Error(data.error || "Failed to retire employee");
      }
    } catch (error) {
      console.error("Failed to retire employee:", error);
      alert("退職処理に失敗しました");
    }
  };

  const handleReactivate = async (employee: Employee) => {
    if (!confirm(`${employee.employee_name}さんを復職させますか？`)) return;

    try {
      const response = await fetch(
        `/api/syaryo/employees/${employee.employee_id}/reactivate`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        alert(`${employee.employee_name}さんを復職させました`);
        fetchEmployees();
      } else {
        throw new Error("Failed to reactivate");
      }
    } catch (error) {
      console.error("Failed to reactivate employee:", error);
      alert("復職処理に失敗しました");
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UserCheck className="w-3 h-3 mr-1" />
          在職中
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <UserX className="w-3 h-3 mr-1" />
        退職済み
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Users className="h-8 w-8 mr-3 text-blue-600" />
                社員管理
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                社員の雇用状態を管理します
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* フィルター */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeResigned}
              onChange={(e) => setIncludeResigned(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              退職者も表示する
            </span>
          </label>
        </div>
      </div>

      {/* 社員一覧 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">読み込み中...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">社員がいません</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    社員情報
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    部署
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    入社日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.employee_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Briefcase className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {employee.employee_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.employee_id}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {employee.department || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "-"}
                      </div>
                      {employee.resignation_date && (
                        <div className="text-sm text-gray-500">
                          退職:{" "}
                          {new Date(
                            employee.resignation_date
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(employee.employment_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {employee.employment_status === "active" ? (
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowRetireModal(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          退職処理
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(employee)}
                          className="text-green-600 hover:text-green-900"
                        >
                          復職
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 退職モーダル */}
      {showRetireModal && selectedEmployee && (
        <RetireModal
          employee={selectedEmployee}
          onClose={() => {
            setShowRetireModal(false);
            setSelectedEmployee(null);
          }}
          onRetire={(date) => {
            handleRetire(selectedEmployee, date);
            setShowRetireModal(false);
            setSelectedEmployee(null);
          }}
        />
      )}
    </div>
  );
}

function RetireModal({
  employee,
  onClose,
  onRetire,
}: {
  employee: Employee;
  onClose: () => void;
  onRetire: (date: Date) => void;
}) {
  const [resignationDate, setResignationDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleSubmit = () => {
    if (!resignationDate) {
      alert("退職日を選択してください");
      return;
    }

    if (
      !confirm(
        `${employee.employee_name}さんを退職処理しますか？\n\n` +
          `この操作により、関連する全ての書類（免許証、車検証、任意保険）が論理削除されます。\n` +
          `削除されたデータは通知の対象外となります。`
      )
    ) {
      return;
    }

    onRetire(new Date(resignationDate));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">退職処理</h2>
        <p className="text-sm text-gray-600 mb-4">
          {employee.employee_name}さんを退職処理します。
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline-block w-4 h-4 mr-1" />
            退職日
          </label>
          <input
            type="date"
            value={resignationDate}
            onChange={(e) => setResignationDate(e.target.value)}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
          <p className="text-xs text-yellow-700">
            <strong>注意:</strong>{" "}
            この操作により、以下のデータが論理削除されます：
          </p>
          <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
            <li>免許証</li>
            <li>車検証</li>
            <li>任意保険証</li>
          </ul>
          <p className="text-xs text-yellow-700 mt-2">
            削除されたデータは有効期限通知の対象外となります。
          </p>
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            退職処理を実行
          </button>
        </div>
      </div>
    </div>
  );
}
