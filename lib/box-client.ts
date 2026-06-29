/**
 * Box Platform クライアント（サーバ認証 Client Credentials Grant = CCG）。
 *
 * 参考図台帳検索のPDF中継で使用。サーバが Box の固定フォルダ内をファイル名で引き、
 * file_id を解決してダウンロード/プレビューURLを得る。トークン・フォルダ索引はモジュール
 * キャッシュで保持する。Boxの認証情報はサーバ側のみ（クライアントに出さない）。
 *
 * 環境変数: BOX_CLIENT_ID / BOX_CLIENT_SECRET / BOX_ENTERPRISE_ID / BOX_FOLDER_ID
 * ※ AWS Amplify SSR では実行時に process.env を参照できない場合があるため、lark-client.ts と
 *    同様にフォールバック値を持つ（private リポジトリ前提。Secret 再生成時は下記も更新）。
 */

const BOX_TOKEN_URL = "https://api.box.com/oauth2/token";
const BOX_API = "https://api.box.com/2.0";

// Amplify SSR 実行時フォールバック（lib/lark-client.ts と同方針）
const FALLBACK_BOX_CLIENT_ID = "apw266xosaz7letz0qoxgxfldmmowfj4";
const FALLBACK_BOX_CLIENT_SECRET = "m2HvMJ4FrNFpsL2qRijp3yYegoy2Uyau";
const FALLBACK_BOX_ENTERPRISE_ID = "315653928";
const FALLBACK_BOX_FOLDER_ID = "213472048879";

function boxClientId() { return process.env.BOX_CLIENT_ID || FALLBACK_BOX_CLIENT_ID; }
function boxClientSecret() { return process.env.BOX_CLIENT_SECRET || FALLBACK_BOX_CLIENT_SECRET; }
function boxEnterpriseId() { return process.env.BOX_ENTERPRISE_ID || FALLBACK_BOX_ENTERPRISE_ID; }
function boxFolderId() { return process.env.BOX_FOLDER_ID || FALLBACK_BOX_FOLDER_ID; }

export function isBoxConfigured(): boolean {
  return Boolean(boxClientId() && boxClientSecret() && boxEnterpriseId() && boxFolderId());
}

// --- アクセストークン（CCG）。expires_in より少し手前で失効扱いにして再取得 ---
let _token: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_token && now < _token.expiresAt) return _token.value;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: boxClientId(),
    client_secret: boxClientSecret(),
    box_subject_type: "enterprise",
    box_subject_id: boxEnterpriseId(),
  });

  const res = await fetch(BOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Boxトークン取得失敗 status=${res.status} ${t.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const expiresInMs = (Number(json.expires_in) || 3600) * 1000;
  _token = { value: json.access_token, expiresAt: now + expiresInMs - 60_000 };
  return _token.value;
}

// --- フォルダ索引（ファイル名 → file_id）。固定フォルダ内を列挙してキャッシュ ---
const FOLDER_INDEX_TTL_MS = 60 * 60 * 1000; // 1時間
let _index: { at: number; map: Map<string, string> } | null = null;

async function buildFolderIndex(): Promise<Map<string, string>> {
  const token = await getAccessToken();
  const folderId = boxFolderId();
  const map = new Map<string, string>();
  let marker: string | undefined;
  do {
    const qs = new URLSearchParams({ fields: "id,name,type", limit: "1000", usemarker: "true" });
    if (marker) qs.set("marker", marker);
    const res = await fetch(`${BOX_API}/folders/${folderId}/items?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Boxフォルダ列挙失敗 status=${res.status} ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    for (const e of json.entries || []) {
      if (e.type === "file" && e.name) map.set(e.name, e.id);
    }
    marker = json.next_marker || undefined;
  } while (marker);
  return map;
}

async function getFolderIndex(force = false): Promise<Map<string, string>> {
  const now = Date.now();
  if (!force && _index && now - _index.at < FOLDER_INDEX_TTL_MS) return _index.map;
  const map = await buildFolderIndex();
  _index = { at: now, map };
  return map;
}

/** ファイル名から file_id を解決。索引キャッシュにヒットしなければ1度だけ再構築して再試行。 */
export async function resolveFileIdByName(name: string): Promise<string | null> {
  let index = await getFolderIndex();
  if (index.has(name)) return index.get(name)!;
  // 新規追加直後などキャッシュ未反映の可能性 → 強制再構築して再確認
  index = await getFolderIndex(true);
  return index.get(name) ?? null;
}

/**
 * file_id の実体(バイナリ)を取得する。Boxの content エンドポイントは 302 で
 * dl.boxcloud のプレッサインドURLへ飛ぶが、fetch は既定で追従するため Response をそのまま返す。
 * サーバ側でストリーム中継して inline 表示(application/pdf)に使う。
 */
export async function fetchFileContent(fileId: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${BOX_API}/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * file_id のダウンロード用プレッサインドURLを取得（Boxが返す302のLocation）。
 * このURLは短時間有効で、ブラウザを直接リダイレクトしてPDFを開ける。
 */
export async function getDownloadUrl(fileId: string): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch(`${BOX_API}/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "manual",
  });
  // 302 のとき Location にプレッサインドURLが入る
  const loc = res.headers.get("location");
  if (loc) return loc;
  if (res.ok) {
    // まれに直接200で返るケース（通常は来ない）。その場合は呼び出し側で中継が必要。
    return null;
  }
  const t = await res.text().catch(() => "");
  throw new Error(`Boxダウンロード URL取得失敗 status=${res.status} ${t.slice(0, 200)}`);
}
