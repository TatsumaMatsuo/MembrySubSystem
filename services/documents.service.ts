import { getBaseRecords, createBaseRecord, updateBaseRecord } from "@/lib/lark-client";
import { getLarkTables, PROJECT_DOCUMENT_FIELDS, DOCUMENT_CATEGORIES } from "@/lib/lark-tables";
import type { ProjectDocument, DepartmentName, LarkAttachment } from "@/types";

/**
 * 製番に紐付く案件書庫を取得（新しいテーブル構造に対応）
 * テーブル構造: 各書類種別がフィールド名として直接使用されている
 * 例: "ミルシート" フィールドに添付ファイルが格納
 */
export async function getDocumentsBySeiban(seiban: string): Promise<ProjectDocument[]> {
  const tables = getLarkTables();
  const filter = `CurrentValue.[${PROJECT_DOCUMENT_FIELDS.seiban}] = "${seiban}"`;

  const response = await getBaseRecords(tables.PROJECT_DOCUMENTS, {
    filter,
    pageSize: 200,
  });

  if (!response.data?.items || response.data.items.length === 0) {
    return [];
  }

  // 最初のレコードを使用（製番ごとに1レコードの想定）
  const item = response.data.items[0];
  const fields = item.fields || {};
  const documents: ProjectDocument[] = [];

  // 全ての書類カテゴリをチェック
  for (const [dept, categories] of Object.entries(DOCUMENT_CATEGORIES)) {
    for (const docType of categories) {
      const fileData = fields[docType];
      if (fileData && Array.isArray(fileData) && fileData.length > 0) {
        // 添付ファイルがある場合
        documents.push({
          record_id: item.record_id || "",
          seiban: String(fields[PROJECT_DOCUMENT_FIELDS.seiban] || seiban),
          document_type: docType,
          department: dept,
          file_attachment: fileData as LarkAttachment[],
          updated_at: fields["日付"] as number | undefined,
        });
      }
    }
  }

  console.log("[documents.service] Found documents:", documents.map(d => ({
    type: d.document_type,
    dept: d.department,
    files: d.file_attachment?.length || 0,
  })));

  return documents;
}

/**
 * 部署別に書類をグループ化
 */
export function groupDocumentsByDepartment(
  documents: ProjectDocument[]
): Record<DepartmentName, Record<string, ProjectDocument | null>> {
  const grouped: Record<DepartmentName, Record<string, ProjectDocument | null>> = {
    営業部: {},
    設計部: {},
    製造部: {},
    工務課: {},
  };

  // 各部署のカテゴリを初期化（全てnull）
  for (const [dept, categories] of Object.entries(DOCUMENT_CATEGORIES)) {
    for (const category of categories) {
      grouped[dept as DepartmentName][category] = null;
    }
  }

  // 書類をグループに配置
  for (const doc of documents) {
    const dept = doc.department as DepartmentName;
    if (grouped[dept] && doc.document_type in grouped[dept]) {
      grouped[dept][doc.document_type] = doc;
    }
  }

  return grouped;
}

/**
 * 書類を新規作成
 */
export async function createDocument(
  seiban: string,
  department: DepartmentName,
  documentType: string,
  fileAttachment: ProjectDocument["file_attachment"]
) {
  const tables = getLarkTables();

  return createBaseRecord(tables.PROJECT_DOCUMENTS, {
    [PROJECT_DOCUMENT_FIELDS.seiban]: seiban,
    [PROJECT_DOCUMENT_FIELDS.department]: department,
    [PROJECT_DOCUMENT_FIELDS.document_type]: documentType,
    [PROJECT_DOCUMENT_FIELDS.file_attachment]: fileAttachment,
    [PROJECT_DOCUMENT_FIELDS.updated_at]: Date.now(),
    [PROJECT_DOCUMENT_FIELDS.version]: 1,
  });
}

/**
 * 書類を更新
 */
export async function updateDocument(
  recordId: string,
  fileAttachment: ProjectDocument["file_attachment"],
  currentVersion: number = 1
) {
  const tables = getLarkTables();

  return updateBaseRecord(tables.PROJECT_DOCUMENTS, recordId, {
    [PROJECT_DOCUMENT_FIELDS.file_attachment]: fileAttachment,
    [PROJECT_DOCUMENT_FIELDS.updated_at]: Date.now(),
    [PROJECT_DOCUMENT_FIELDS.version]: currentVersion + 1,
  });
}
