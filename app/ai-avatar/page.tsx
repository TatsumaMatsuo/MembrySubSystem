"use client";

// 音声アバターWebアプリ プロトタイプ(Epic #30 / トラック2)
//
// 目的: shainai への到達経路(内部HTTPS公開)承認を待たずに、アバター描画+双方向音声の
//   フロント体験を先に固める。バックエンドは **モック**(shainai不要)。承認後に
//   askBackend() をコミット1974042の実装(/api/chat/token → shainai /api/chat)へ差し替えるだけ。
//
// 機能: 音声入力(Web Speech Recognition)/音声出力(SpeechSynthesis, 外部送信ゼロ)/
//   まばたき+発話中の口パク/声の選択/会話履歴。すべて外部CDN非依存。
//   ※音声認識はChrome/Edge等のみ対応。非対応環境はテキスト入力にフォールバック。
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import { MainLayout } from "@/components/layout";
import { Send, Volume2, Loader2, Square, Mic, MicOff } from "lucide-react";

// 3Dアバターは WebGL(window)依存のためクライアントのみで描画(SSR無効)
const Avatar3D = dynamicImport(() => import("@/components/ai-avatar/Avatar3D"), {
  ssr: false,
  loading: () => <div className="h-52 w-52 md:h-64 md:w-64" />,
});

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
interface Turn {
  role: "user" | "assistant";
  text: string;
  route?: RouteKind;
  citations?: Citation[];
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

export default function AiAvatarPrototypePage() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const [sttAvailable, setSttAvailable] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ---- TTS(音声出力)voices ロード ----
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setTtsAvailable(false);
      return;
    }
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const ja = all.filter((v) => v.lang?.startsWith("ja"));
      const list = ja.length ? ja : all;
      setVoices(list);
      setVoiceURI((cur) => cur || list[0]?.voiceURI || "");
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find((x) => x.voiceURI === voiceURI);
      u.lang = v?.lang || "ja-JP";
      if (v) u.voice = v;
      u.rate = 1.05;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [voices, voiceURI]
  );

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const handleSend = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      stopSpeak();
      setInput("");
      setAnswer(null);
      setTurns((t) => [...t, { role: "user", text }]);
      setLoading(true);
      try {
        const ans = await askBackend(text);
        setAnswer(ans);
        setTurns((t) => [
          ...t,
          { role: "assistant", text: ans.text, route: ans.route, citations: ans.citations },
        ]);
        speak(ans.text);
      } finally {
        setLoading(false);
      }
    },
    [loading, speak]
  );

  // ---- STT(音声入力)初期化 ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSttAvailable(false);
      return;
    }
    setSttAvailable(true);
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr;
        else interim += tr;
      }
      if (final) {
        setInput("");
        setListening(false);
        handleSend(final);
      } else {
        setInput(interim);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    };
  }, [handleSend]);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    stopSpeak();
    setInput("");
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center gap-5 px-4 py-6">
        <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
          プロトタイプ（音声=ブラウザ内蔵 / 回答=モック）。実バックエンド接続は shainai 公開の承認後。
        </div>

        <Avatar3D talking={speaking} thinking={loading} />

        {/* 声の選択 */}
        {ttsAvailable && voices.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Volume2 className="h-3.5 w-3.5" />
            <select
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}（{v.lang}）
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 現在の回答 */}
        <div className="min-h-[92px] w-full rounded-2xl bg-white p-5 shadow-sm">
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{answer.text}</p>
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
              マイクで話しかけるか、下に入力してください。例:「有給休暇について教えて」
            </p>
          )}
        </div>

        {/* 入力(マイク + テキスト) */}
        <div className="flex w-full items-end gap-2">
          {sttAvailable && (
            <button
              onClick={toggleMic}
              className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white transition ${
                listening ? "animate-pulse bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"
              }`}
              title={listening ? "停止" : "マイクで話す"}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            rows={1}
            placeholder={listening ? "聞き取り中…" : "質問を入力（Enterで送信）"}
            className="max-h-32 flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>

        {!ttsAvailable && <p className="text-xs text-red-500">このブラウザは音声合成に対応していません。</p>}
        {!sttAvailable && (
          <p className="text-xs text-gray-400">
            ※このブラウザは音声入力(マイク)に非対応です。テキスト入力をご利用ください（Chrome/Edge推奨）。
          </p>
        )}

        {/* 会話履歴 */}
        {turns.length > 0 && (
          <div className="mt-2 w-full space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400">会話履歴</p>
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    t.role === "user" ? "bg-indigo-500 text-white" : "bg-white text-gray-700 shadow-sm"
                  }`}
                >
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
