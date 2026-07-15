"use client";

// 音声アバターWebアプリ プロトタイプ(Epic #30 / トラック2)
//
// 目的: shainai への到達経路(内部HTTPS公開)承認を待たずに、アバター描画+音声回答の
//   フロント体験を先に固める。バックエンドは **モック**(shainai不要)。承認後に
//   askBackend() をコミット1974042の実装(/api/chat/token → shainai /api/chat)へ差し替えるだけ。
//
// 設計メモ:
//   - TTS は外部送信ゼロの Web Speech API(SpeechSynthesis)を既定採用(SEC-01維持)。
//     高品質音声が要る場合のみ外部/社内TTSを別途検討(データ経路の判断が必要)。
//   - アバターは外部CDN非依存の自前SVG。speaking 中だけ口を開閉アニメ。
//   - このページはメニュー未登録(プロトタイプ)。URL直打ちのみ・middleware保護下。
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { MainLayout } from "@/components/layout";
import { Send, Volume2, Loader2, Square } from "lucide-react";

type RouteKind = "internal" | "general";
interface Citation {
  title: string;
  url: string;
}
interface Answer {
  text: string;
  route: RouteKind;
  citations: Citation[];
}

// ==== モック・バックエンド(shainai到達承認後に実バックエンドへ差し替え) ====
// 実装時: /api/chat/token で短命JWT取得 → shainai /api/chat へ POST(commit 1974042 参照)。
async function askBackend(text: string): Promise<Answer> {
  await new Promise((r) => setTimeout(r, 700 + Math.min(text.length * 15, 800)));
  const q = text.trim();
  if (/有給|休暇|年休/.test(q)) {
    return {
      text:
        "有給休暇は入社6か月経過かつ全労働日の8割以上出勤で10日付与されます（就業規則 第32条）。取得はワークフローから申請してください。半日単位の取得も可能です。",
      route: "internal",
      citations: [
        { title: "就業規則 第4章 休暇", url: "https://example.invalid/kisoku#ch4" },
        { title: "有給休暇 申請フロー", url: "https://example.invalid/flow/yukyu" },
      ],
    };
  }
  if (/経費|精算|立替/.test(q)) {
    return {
      text:
        "経費精算は毎月末締め・翌月10日払いです。領収書を添付し、勘定科目を選択して申請してください。5万円以上は事前稟議が必要です。",
      route: "internal",
      citations: [{ title: "経費精算規程", url: "https://example.invalid/keihi" }],
    };
  }
  return {
    text: `「${q}」について、社内ナレッジと一般知識をもとにお答えします。（これはプロトタイプのモック応答です。実際の回答は承認後に社内AI shainai から取得します。）`,
    route: "general",
    citations: [],
  };
}
// ============================================================================

function pickJaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ja-JP") ||
    voices.find((v) => v.lang?.startsWith("ja")) ||
    null
  );
}

// 依存ゼロの SVG アバター。talking 中は口を開閉。
function Avatar({ talking, thinking }: { talking: boolean; thinking: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="h-44 w-44 md:h-56 md:w-56" aria-hidden>
      <defs>
        <radialGradient id="bg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#eef2ff" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#bg)" />
      {/* 顔 */}
      <circle cx="100" cy="96" r="66" fill="#fde9d9" stroke="#f2c9a8" strokeWidth="2" />
      {/* 目 */}
      <g fill="#3b3b52">
        <circle cx="78" cy="88" r="7" className={thinking ? "animate-pulse" : ""} />
        <circle cx="122" cy="88" r="7" className={thinking ? "animate-pulse" : ""} />
      </g>
      {/* ほお */}
      <circle cx="70" cy="112" r="8" fill="#fbcfe8" opacity="0.7" />
      <circle cx="130" cy="112" r="8" fill="#fbcfe8" opacity="0.7" />
      {/* 口: talking 中は scaleY アニメ */}
      <ellipse
        cx="100"
        cy="126"
        rx="20"
        ry={talking ? 12 : 4}
        fill="#8b3a3a"
        style={{
          transformOrigin: "100px 126px",
          transition: "ry 90ms ease",
        }}
        className={talking ? "avatar-talk" : ""}
      />
      <style>{`
        @keyframes avatarTalk { 0%,100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        .avatar-talk { animation: avatarTalk 260ms ease-in-out infinite; }
      `}</style>
    </svg>
  );
}

export default function AiAvatarPrototypePage() {
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTtsAvailable(false);
      return;
    }
    const load = () => {
      voiceRef.current = pickJaVoice();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 1.05;
    u.pitch = 1.0;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    stopSpeak();
    setInput("");
    setLoading(true);
    setAnswer(null);
    try {
      const ans = await askBackend(text);
      setAnswer(ans);
      speak(ans.text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center gap-6 px-4 py-8">
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
          プロトタイプ（音声=ブラウザ内蔵TTS / 回答=モック）。実バックエンド接続は shainai 公開の承認後。
        </div>

        <Avatar talking={speaking} thinking={loading} />

        {/* 回答表示 */}
        <div className="min-h-[96px] w-full rounded-2xl bg-white p-5 shadow-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 考えています…
            </div>
          ) : answer ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    answer.route === "internal"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {answer.route === "internal" ? "社内ナレッジ" : "一般AI"}
                </span>
                <button
                  onClick={() => (speaking ? stopSpeak() : speak(answer.text))}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  {speaking ? "停止" : "もう一度読み上げ"}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {answer.text}
              </p>
              {answer.citations.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                  {answer.citations.map((c, i) => (
                    <li key={i}>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {c.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-400">
              質問すると、アバターが音声で回答します。例:「有給休暇について教えて」
            </p>
          )}
        </div>

        {!ttsAvailable && (
          <p className="text-xs text-red-500">
            このブラウザは音声合成(Web Speech API)に対応していません。テキストのみ表示します。
          </p>
        )}

        {/* 入力 */}
        <div className="flex w-full items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="質問を入力（Enterで送信）"
            className="max-h-32 flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
