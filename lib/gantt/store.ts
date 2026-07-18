// ガントチャート機能のサーバ側データアクセス（#95）。Lark Base の GANTT_CHART / GANTT_TEMPLATE を操作。
// 明細はデータJSON列に格納する2テーブル方式。作成者/日時はLark自動フィールドに任せ、実ユーザーはJSONに保持。
import { getBaseRecords, createBaseRecord, updateBaseRecord, deleteBaseRecord } from "@/lib/lark-client";
import { escapeLarkFilterValue } from "@/lib/lark-filter";
import { getLarkTables, GANTT_CHART_FIELDS as CF, GANTT_TEMPLATE_FIELDS as TF } from "@/lib/lark-tables";
import type { GanttChartFull, GanttChartMeta, GanttChartPayload, GanttTemplateFull, GanttTemplateMeta, GanttTemplatePayload } from "@/lib/gantt/types";

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((s: any) => (s && typeof s === "object" && s.text != null ? s.text : s)).join("");
  if (typeof v === "object" && (v as any).text != null) return String((v as any).text);
  return String(v);
}
function parseJson<T>(v: unknown, fallback: T): T {
  const s = text(v);
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
function numberOr(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ==================== ガントチャート ====================

async function findChartRecord(id: string) {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${CF.chart_id}] = "${escapeLarkFilterValue(id)}"`;
  const res = await getBaseRecords(tables.GANTT_CHART, { filter, pageSize: 1 });
  return res.data?.items?.[0];
}

export async function listCharts(opts?: { q?: string; seiban?: string }): Promise<GanttChartMeta[]> {
  const tables = getLarkTables();
  const res = await getBaseRecords(tables.GANTT_CHART, { pageSize: 200 });
  const items = res.data?.items || [];
  const metas: GanttChartMeta[] = items
    .map((rec: any) => {
      const data = parseJson<GanttChartPayload>(rec.fields?.[CF.data_json], { unit: "day", tasks: [] });
      return {
        id: text(rec.fields?.[CF.chart_id]),
        title: text(rec.fields?.[CF.title]),
        seiban: text(rec.fields?.[CF.seiban]),
        author: text(rec.fields?.[CF.created_by]) || data.author || "",
        createdAt: numberOr(rec.fields?.[CF.created_at]) ?? data.createdAt,
        updatedAt: numberOr(rec.fields?.[CF.updated_at]) ?? data.updatedAt,
      } as GanttChartMeta;
    })
    .filter((m) => m.id);
  const q = (opts?.q || "").trim().toLowerCase();
  const seiban = (opts?.seiban || "").trim();
  const filtered = metas.filter((m) => {
    if (seiban && (m.seiban || "") !== seiban) return false;
    if (q && !(`${m.title} ${m.author} ${m.seiban}`.toLowerCase().includes(q))) return false;
    return true;
  });
  filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return filtered;
}

export async function getChart(id: string): Promise<GanttChartFull | null> {
  const rec = await findChartRecord(id);
  if (!rec) return null;
  const data = parseJson<GanttChartPayload>(rec.fields?.[CF.data_json], { unit: "day", tasks: [] });
  return {
    id: text(rec.fields?.[CF.chart_id]),
    title: text(rec.fields?.[CF.title]),
    seiban: text(rec.fields?.[CF.seiban]),
    author: text(rec.fields?.[CF.created_by]) || data.author || "",
    createdAt: numberOr(rec.fields?.[CF.created_at]) ?? data.createdAt,
    updatedAt: numberOr(rec.fields?.[CF.updated_at]) ?? data.updatedAt,
    data,
  };
}

export async function upsertChart(input: {
  id?: string;
  title: string;
  seiban?: string;
  data: GanttChartPayload;
  user?: { name?: string; email?: string };
}): Promise<{ id: string }> {
  const tables = getLarkTables();
  const now = Date.now();
  const existing = input.id ? await findChartRecord(input.id) : null;
  const id = input.id && existing ? input.id : genId("GC");

  const prevData = existing ? parseJson<GanttChartPayload>(existing.fields?.[CF.data_json], { unit: "day", tasks: [] }) : null;
  const payload: GanttChartPayload = {
    ...input.data,
    author: prevData?.author || input.user?.name || input.data.author || "",
    authorEmail: prevData?.authorEmail || input.user?.email || input.data.authorEmail || "",
    createdAt: prevData?.createdAt || now,
    updatedAt: now,
  };
  const fields: Record<string, any> = {
    [CF.chart_id]: id,
    [CF.title]: input.title || "(無題)",
    [CF.seiban]: input.seiban || "",
    [CF.data_json]: JSON.stringify(payload),
    [CF.updated_at]: now,
  };
  if (existing?.record_id) {
    // 作成者/作成日時は初回のみ。更新時は保持(送らない)。
    await updateBaseRecord(tables.GANTT_CHART, existing.record_id, fields);
  } else {
    fields[CF.created_by] = input.user?.name || "";
    fields[CF.created_at] = now;
    await createBaseRecord(tables.GANTT_CHART, fields);
  }
  return { id };
}

export async function deleteChart(id: string): Promise<boolean> {
  const tables = getLarkTables();
  const rec = await findChartRecord(id);
  if (!rec?.record_id) return false;
  await deleteBaseRecord(tables.GANTT_CHART, rec.record_id);
  return true;
}

// ==================== ガントひな形 ====================

async function findTemplateRecord(id: string) {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${TF.template_id}] = "${escapeLarkFilterValue(id)}"`;
  const res = await getBaseRecords(tables.GANTT_TEMPLATE, { filter, pageSize: 1 });
  return res.data?.items?.[0];
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

export async function listTemplates(opts?: { includeInactive?: boolean }): Promise<GanttTemplateMeta[]> {
  const tables = getLarkTables();
  const res = await getBaseRecords(tables.GANTT_TEMPLATE, { pageSize: 200 });
  const items = res.data?.items || [];
  const metas: GanttTemplateMeta[] = items
    .map((rec: any) => {
      const data = parseJson<GanttTemplatePayload>(rec.fields?.[TF.data_json], { steps: [] });
      return {
        id: text(rec.fields?.[TF.template_id]),
        name: text(rec.fields?.[TF.name]),
        category: text(rec.fields?.[TF.category]),
        active: toBool(rec.fields?.[TF.is_active]),
        updatedAt: numberOr(rec.fields?.[TF.updated_at]) ?? data.updatedAt,
      } as GanttTemplateMeta;
    })
    .filter((m) => m.id && (opts?.includeInactive || m.active));
  metas.sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || ""));
  return metas;
}

export async function getTemplate(id: string): Promise<GanttTemplateFull | null> {
  const rec = await findTemplateRecord(id);
  if (!rec) return null;
  const data = parseJson<GanttTemplatePayload>(rec.fields?.[TF.data_json], { steps: [] });
  return {
    id: text(rec.fields?.[TF.template_id]),
    name: text(rec.fields?.[TF.name]),
    category: text(rec.fields?.[TF.category]),
    active: toBool(rec.fields?.[TF.is_active]),
    updatedAt: data.updatedAt,
    data,
  };
}

export async function upsertTemplate(input: {
  id?: string;
  name: string;
  category?: string;
  active?: boolean;
  data: GanttTemplatePayload;
  user?: { name?: string };
}): Promise<{ id: string }> {
  const tables = getLarkTables();
  const now = Date.now();
  const existing = input.id ? await findTemplateRecord(input.id) : null;
  const id = input.id && existing ? input.id : genId("TMPL");
  const payload: GanttTemplatePayload = { ...input.data, updatedBy: input.user?.name || input.data.updatedBy || "", updatedAt: now };
  const fields: Record<string, any> = {
    [TF.template_id]: id,
    [TF.name]: input.name || "(無題ひな形)",
    [TF.category]: input.category || "",
    [TF.is_active]: input.active !== false,
    [TF.data_json]: JSON.stringify(payload),
    [TF.updated_by]: input.user?.name || "",
    [TF.updated_at]: now,
  };
  if (existing?.record_id) await updateBaseRecord(tables.GANTT_TEMPLATE, existing.record_id, fields);
  else await createBaseRecord(tables.GANTT_TEMPLATE, fields);
  return { id };
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const tables = getLarkTables();
  const rec = await findTemplateRecord(id);
  if (!rec?.record_id) return false;
  await deleteBaseRecord(tables.GANTT_TEMPLATE, rec.record_id);
  return true;
}
