// ガントチャート機能のデータモデル（#95。クライアント/サーバ共有）

export type GanttUnit = "day" | "week" | "month";

// タスク(工程)1件
export interface GanttTaskData {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD（当日を含む終了日）
  assignee?: string;
  progress?: number; // 0-100
  pred?: string[]; // 先行タスクID（依存線。MVPでは保持のみ）
  notes?: string;
}

// データJSONに格納する本体
export interface GanttChartPayload {
  unit: GanttUnit;
  from?: string; // 表示期間From（YYYY-MM-DD）
  to?: string; // 表示期間To（YYYY-MM-DD）
  tasks: GanttTaskData[];
  author?: string; // 実作成者（Lark自動作成者はBotのため）
  authorEmail?: string;
  createdAt?: number; // epoch ms（アプリ設定）
  updatedAt?: number;
}

// 一覧・検索で使うメタ情報
export interface GanttChartMeta {
  id: string;
  title: string;
  seiban?: string;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface GanttChartFull extends GanttChartMeta {
  data: GanttChartPayload;
}

// ---- ひな形（工程マスタ） ----
export interface GanttTemplateStep {
  name: string;
  days: number; // 標準所要日数
  offset: number; // 開始オフセット日数（基準日からの日数）
  notes?: string;
}

export interface GanttTemplatePayload {
  notes?: string;
  steps: GanttTemplateStep[];
  updatedBy?: string;
  updatedAt?: number;
}

export interface GanttTemplateMeta {
  id: string;
  name: string;
  category?: string;
  active: boolean;
  updatedAt?: number;
}

export interface GanttTemplateFull extends GanttTemplateMeta {
  data: GanttTemplatePayload;
}
