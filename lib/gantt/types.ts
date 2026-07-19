// ガントチャート機能のデータモデル（#95。クライアント/サーバ共有）

export type GanttUnit = "day" | "week" | "month";

// 会社カレンダーの休日（背景色反映用）
export interface GanttHoliday {
  date: string; // YYYY-MM-DD
  name?: string;
}

// バーの既定色パレット（未指定タスクにインデックス順で割当。エディタの色見本とも共有）
export const GANTT_PALETTE = [
  "#4f46e5", // indigo
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#7c3aed", // violet
  "#db2777", // pink
  "#0d9488", // teal
];

// タスク(工程)1件
export interface GanttTaskData {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD（当日を含む終了日）
  assignee?: string;
  color?: string; // バー色（未指定時はパレット既定色）
  pred?: string[]; // 先行タスクID（依存線でつなぐ）
  notes?: string;
  progress?: number; // 0-100（UIでは廃止。過去データの後方互換のため型は保持）
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
  ownerEmail?: string; // 作成者（所有者）メール。非公開ひな形の閲覧可否判定に使用
  ownerName?: string; // 作成者表示名
  isPublic?: boolean; // 全体公開（true=全員 / false=自分のみ）。未設定は公開扱い(後方互換)
}

export interface GanttTemplateMeta {
  id: string;
  name: string;
  category?: string;
  active: boolean;
  updatedAt?: number;
  isPublic?: boolean; // 全体公開フラグ
  ownerName?: string; // 作成者表示名（公開ひな形で他者作成のものを判別）
  mine?: boolean; // 現在のユーザーが所有者か
}

export interface GanttTemplateFull extends GanttTemplateMeta {
  data: GanttTemplatePayload;
}
