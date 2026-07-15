// VOICEVOX(日本語ニューラルTTS)クライアント(Epic #30 音声アバター)
//
// VOICEVOX エンジンの HTTP API を叩いて音声(WAV)を合成する。
//   1) POST /audio_query?speaker=<id>&text=... → クエリJSON
//   2) POST /synthesis?speaker=<id>  (body=クエリJSON) → WAV(ArrayBuffer)
//
// 設計方針: 社内完結(外部送信なし=SEC-01維持)。プロトタイプはローカルエンジン
//   (http://localhost:50021)、本番は shainai/社内に自己ホストしたエンジンを指す。

export interface VoicevoxSpeakerStyle {
  name: string; // キャラ名
  styleName: string; // スタイル名(ノーマル/あまあま等)
  id: number; // speaker id
}

export interface SynthesizeOptions {
  baseUrl: string;
  speaker: number;
  speedScale?: number;
  pitchScale?: number;
  intonationScale?: number;
}

export async function synthesizeVoicevox(
  text: string,
  o: SynthesizeOptions
): Promise<ArrayBuffer> {
  const qs = `speaker=${o.speaker}&text=${encodeURIComponent(text)}`;
  const qRes = await fetch(`${o.baseUrl}/audio_query?${qs}`, { method: "POST" });
  if (!qRes.ok) throw new Error(`VOICEVOX audio_query 失敗 (HTTP ${qRes.status})`);
  const query = await qRes.json();
  if (o.speedScale != null) query.speedScale = o.speedScale;
  if (o.pitchScale != null) query.pitchScale = o.pitchScale;
  if (o.intonationScale != null) query.intonationScale = o.intonationScale;

  const sRes = await fetch(`${o.baseUrl}/synthesis?speaker=${o.speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!sRes.ok) throw new Error(`VOICEVOX synthesis 失敗 (HTTP ${sRes.status})`);
  return sRes.arrayBuffer();
}

// 利用可能な話者(キャラ×スタイル)一覧を取得
export async function fetchVoicevoxSpeakers(baseUrl: string): Promise<VoicevoxSpeakerStyle[]> {
  const res = await fetch(`${baseUrl}/speakers`);
  if (!res.ok) throw new Error(`VOICEVOX speakers 取得失敗 (HTTP ${res.status})`);
  const data = (await res.json()) as Array<{
    name: string;
    styles: Array<{ name: string; id: number }>;
  }>;
  const out: VoicevoxSpeakerStyle[] = [];
  for (const c of data) {
    for (const s of c.styles) {
      out.push({ name: c.name, styleName: s.name, id: s.id });
    }
  }
  return out;
}
