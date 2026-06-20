/**
 * 防御的な JSON フェッチ。
 *
 * 背景: API ルートは必ず JSON を返すが、Amplify のゲートウェイタイムアウト(約28秒)や
 * サーバーレス関数のクラッシュ時は「空ボディ(204/502/504)」や HTML が返る。
 * その場合に `res.json()` を直接呼ぶと "Unexpected end of JSON input" という
 * 原因不明のエラーになるため、本ヘルパーで状況に応じた日本語メッセージへ変換する。
 */
export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e: any) {
    throw new Error(`通信に失敗しました。ネットワーク状態を確認してください。(${e?.message ?? "network error"})`);
  }

  const text = await res.text();

  // 空ボディ: 多くはゲートウェイタイムアウト(504)/関数クラッシュ(502)
  if (!text) {
    if (res.status === 504 || res.status === 502 || res.status === 408) {
      throw new Error(`処理がタイムアウトしました (HTTP ${res.status})。データ量が多い可能性があります。少し時間をおいて再読込してください。`);
    }
    throw new Error(`サーバーから空の応答が返りました (HTTP ${res.status})。タイムアウトの可能性があります。`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML(サインインへのリダイレクト等)や非JSON応答
    const snippet = text.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(`サーバー応答を解析できませんでした (HTTP ${res.status})。${snippet}`);
  }

  if (!res.ok) {
    throw new Error(json?.error || `サーバーエラー (HTTP ${res.status})`);
  }

  return json as T;
}
