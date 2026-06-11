"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { KPI_NAVY } from "./colors";

export interface TrendPoint {
  /** X軸ラベル(例: "43期" / "8月") */
  label: string;
  /** 実績値(未入力は null = 線を途切れさせる) */
  value: number | null;
}

/**
 * KPI推移の折れ線(recharts)。過去実績の推移 + 任意の目標ライン。
 * 過去実績参照・ダッシュボード等で共通利用。
 */
export function KpiTrendChart({
  data,
  target,
  unit = "",
  color = KPI_NAVY,
  height = 220,
}: {
  data: TrendPoint[];
  /** 目標値(指定すると水平の参照線を表示) */
  target?: number | null;
  unit?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48} />
        <Tooltip
          formatter={(v: any) => [`${v}${unit}`, "実績"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        {target != null && (
          <ReferenceLine
            y={target}
            stroke="#2563eb"
            strokeDasharray="4 4"
            label={{ value: `目標 ${target}${unit}`, fontSize: 10, fill: "#2563eb", position: "insideTopRight" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
