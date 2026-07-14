"use client";

// #32: 社内AIチャット(shainai /api/chat 相乗り)
//
// 認証は MembrySubSystem の next-auth セッション(middleware 保護)に相乗り。
// 回答生成は VPC内 shainai で行い、ブラウザは短命 JWT を付けて直接叩く(SEC-01 方式a)。
//   1. /api/chat/token でセッション open_id を載せた HS256 JWT を取得(サーバ発行)
//   2. その JWT を Authorization: Bearer で shainai /api/chat へ POST(credentials 付き)
//   3. { text, route, citations } を表示(route バッジ / 出典リンク)
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout";
import { fetchJson } from "@/lib/fetch-json";
import { Send, Bot, User as UserIcon, ExternalLink, Loader2 } from "lucide-react";

// shainai /api/chat のエンドポイント(ブラウザ直叩きのため NEXT_PUBLIC でビルド時にインライン)
const CHAT_ENDPOINT = process.env.NEXT_PUBLIC_SHAINAI_CHAT_URL || "";

type RouteKind = "internal" | "general";
interface Citation {
  title: string;
  url: string;
}
interface ChatAnswer {
  text: string;
  route: RouteKind;
  citations: Citation[];
}
interface Message {
  role: "user" | "assistant";
  text: string;
  route?: RouteKind;
  citations?: Citation[];
}

// トークンをメモリキャッシュ。期限が近い/未取得なら再取得する。
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getChatToken(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cachedToken && cachedToken.expiresAt - now > 30_000) {
    return cachedToken.token;
  }
  const data = await fetchJson<{ token: string; expiresIn: number }>(
    "/api/chat/token",
    { cache: "no-store" }
  );
  cachedToken = {
    token: data.token,
    expiresAt: now + (data.expiresIn ?? 600) * 1000,
  };
  return data.token;
}

// shainai /api/chat を叩く。401(トークン失効)なら1回だけ再取得してリトライ。
async function askShainai(text: string): Promise<ChatAnswer> {
  if (!CHAT_ENDPOINT) {
    throw new Error("チャット接続先が未設定です。管理者にご確認ください。");
  }

  const call = async (token: string): Promise<Response> =>
    fetch(CHAT_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

  let token = await getChatToken();
  let res: Response;
  try {
    res = await call(token);
    if (res.status === 401) {
      // トークン失効 → 再発行して1回だけリトライ
      token = await getChatToken(true);
      res = await call(token);
    }
  } catch (e: any) {
    throw new Error(
      `通信に失敗しました。社内ネットワークに接続されているかご確認ください。(${e?.message ?? "network error"})`
    );
  }

  const raw = await res.text();
  let json: any = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`回答を解析できませんでした (HTTP ${res.status})。`);
    }
  }
  if (!res.ok) {
    throw new Error(json?.error || `エラーが発生しました (HTTP ${res.status})`);
  }
  return {
    text: String(json?.text ?? ""),
    route: json?.route === "general" ? "general" : "internal",
    citations: Array.isArray(json?.citations) ? json.citations : [],
  };
}

function RouteBadge({ route }: { route: RouteKind }) {
  const isInternal = route === "internal";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isInternal
          ? "bg-emerald-100 text-emerald-700"
          : "bg-sky-100 text-sky-700"
      }`}
      title={
        isInternal
          ? "社内ナレッジ(RAG)から回答"
          : "一般的なAIによる回答(社内情報は含みません)"
      }
    >
      {isInternal ? "社内ナレッジ" : "一般AI"}
    </span>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const ans = await askShainai(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: ans.text, route: ans.route, citations: ans.citations },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter=送信 / Shift+Enter=改行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <MainLayout>
      <div className="flex h-full flex-col bg-gray-50">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 border-b bg-white px-6 py-4">
          <Bot className="h-6 w-6 text-indigo-500" />
          <div>
            <h1 className="text-lg font-bold text-gray-800">社内AIチャット</h1>
            <p className="text-xs text-gray-500">
              社内ナレッジと一般AIに質問できます。回答には出典が付く場合があります。
            </p>
          </div>
        </div>

        {/* メッセージ一覧 */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6 md:px-6">
          {messages.length === 0 && !loading && (
            <div className="mx-auto mt-10 max-w-md text-center text-gray-400">
              <Bot className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">
                質問を入力してください。<br />
                例:「就業規則の有給休暇について教えて」
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
                  m.role === "user" ? "bg-indigo-500" : "bg-emerald-500"
                }`}
              >
                {m.role === "user" ? (
                  <UserIcon className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                  m.role === "user"
                    ? "bg-indigo-500 text-white"
                    : "bg-white text-gray-800"
                }`}
              >
                {m.role === "assistant" && m.route && (
                  <div className="mb-1.5">
                    <RouteBadge route={m.route} />
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {m.text}
                </div>
                {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    <p className="mb-1 text-xs font-semibold text-gray-500">出典</p>
                    <ul className="space-y-1">
                      {m.citations.map((c, ci) => (
                        <li key={ci}>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3 flex-none" />
                            <span className="break-all">{c.title || c.url}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-500">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                回答を生成しています…
              </div>
            </div>
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 md:mx-6">
            {error}
          </div>
        )}

        {/* 入力欄 */}
        <div className="border-t bg-white px-4 py-3 md:px-6">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
              className="max-h-40 flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
              title="送信"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
