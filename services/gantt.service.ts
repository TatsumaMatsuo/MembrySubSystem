import type { BaiyakuInfo, GanttChartData, GanttTask, DepartmentName } from "@/types";

/**
 * 工程定義
 */
const PROCESS_DEFINITIONS: Array<{
  name: string;
  department: DepartmentName;
  color: string;
  daysFromStart: number;
  duration: number;
}> = [
  { name: "設計", department: "設計部", color: "#3B82F6", daysFromStart: 0, duration: 30 },
  { name: "鉄骨製作", department: "製造部", color: "#10B981", daysFromStart: 20, duration: 45 },
  { name: "膜製作", department: "製造部", color: "#8B5CF6", daysFromStart: 35, duration: 30 },
  { name: "施工準備", department: "工務課", color: "#F59E0B", daysFromStart: 50, duration: 14 },
  { name: "現場施工", department: "工務課", color: "#EF4444", daysFromStart: 64, duration: 21 },
];

/**
 * 売約情報からガントチャートデータを生成
 */
export function generateGanttChartData(baiyaku: BaiyakuInfo): GanttChartData {
  const baseDate = baiyaku.juchu_date || Date.now();
  const tasks: GanttTask[] = [];

  let earliestStart = Infinity;
  let latestEnd = 0;

  PROCESS_DEFINITIONS.forEach((process, index) => {
    const startDate = baseDate + (process.daysFromStart * 24 * 60 * 60 * 1000);
    const endDate = startDate + (process.duration * 24 * 60 * 60 * 1000);

    // 進捗率を計算（現在日時ベース）
    const now = Date.now();
    let progress = 0;
    if (now >= endDate) {
      progress = 100;
    } else if (now > startDate) {
      progress = Math.round(((now - startDate) / (endDate - startDate)) * 100);
    }

    tasks.push({
      id: `${baiyaku.seiban}-${index}`,
      name: process.name,
      department: process.department,
      start_date: startDate,
      end_date: endDate,
      progress,
      color: process.color,
    });

    if (startDate < earliestStart) earliestStart = startDate;
    if (endDate > latestEnd) latestEnd = endDate;
  });

  return {
    seiban: baiyaku.seiban,
    tasks,
    start_date: earliestStart,
    end_date: latestEnd,
  };
}

/**
 * 日付をフォーマット
 */
export function formatGanttDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

/**
 * 期間を計算（日数）
 */
export function calculateDuration(start: number, end: number): number {
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
}
